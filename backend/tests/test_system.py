from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from banking.contract import SPEC, validate
from banking.manage import reconcile, sid


def parallel(functions):
    barrier = Barrier(len(functions))

    def call(fn):
        barrier.wait(timeout=10)
        return fn()

    with ThreadPoolExecutor(max_workers=len(functions)) as pool:
        return list(pool.map(call, functions))


def test_concurrent_duplicate_key_posts_once(bank):
    bank.client("teller")
    key = str(uuid4())
    responses = parallel([lambda: bank.money("withdrawals", "1000", key=key) for _ in range(2)])
    assert responses[0].json()["data"]["id"] == responses[1].json()["data"]["id"]
    assert bank.balance()["posted_balance"] == "2999999000"
    assert sorted(r.headers["Idempotency-Replayed"] for r in responses) == ["false", "true"]


def test_concurrent_withdrawals_cannot_overspend(bank):
    held = bank.money("withdrawals", "2400000000").json()["data"]
    bank.review(held["id"])
    bank.advance(31)
    bank.client("teller")
    result = parallel(
        [lambda: bank.money("withdrawals", "400000000", expected=None) for _ in range(2)]
    )
    assert sorted(r.status_code for r in result) == [201, 409]
    assert bank.balance()["posted_balance"] == "200000000"
    assert bank.balance()["reserved_amount"] == "0"


def test_opposite_transfers_lock_in_same_order(bank):
    bank.client("alice")
    bank.client("bob")
    result = parallel(
        [
            lambda: bank.money("transfers", "1000", role="alice"),
            lambda: bank.money(
                "transfers",
                "2000",
                role="bob",
                source_account_id=bank.ids["bob"],
                destination_account_id=bank.ids["alice"],
            ),
        ]
    )
    assert all(r.json()["data"]["status"] == "posted" for r in result)
    assert bank.balance()["posted_balance"] == "3000001000"
    assert bank.balance("bob")["posted_balance"] == "2999999000"


def test_concurrent_review_decision_is_exactly_once(bank):
    t = bank.money("withdrawals", "1000000001").json()["data"]
    bank.client("analyst")
    result = parallel(
        [
            lambda: bank.review(t["id"], "approve", expected=None),
            lambda: bank.review(t["id"], "reject", expected=None),
        ]
    )
    assert sorted(r.status_code for r in result) == [200, 409]
    assert (
        bank.sql("SELECT count(*) AS n FROM review_actions WHERE transaction_id=:id", id=t["id"])[
            0
        ]["n"]
        == 1
    )
    assert bank.balance()["reserved_amount"] == "0"


def test_out_of_order_received_times_and_inbound_location(bank):
    bank.money("withdrawals", "500000001")
    bank.advance(-20)
    held = bank.money("withdrawals", "500000001").json()["data"]
    assert "RAPID_LARGE_TRANSACTIONS" in held["fraud_reason_codes"]
    bank.review(held["id"], "reject")
    bank.advance(60)
    transfer = bank.money("transfers", "1000", role="alice").json()["data"]
    assert transfer["status"] == "posted"
    assert (
        bank.money(
            "transfers",
            "1000",
            role="bob",
            source_account_id=bank.ids["bob"],
            destination_account_id=bank.ids["alice"],
        ).json()["data"]["status"]
        == "posted"
    )


def test_runtime_role_cannot_tamper_with_ledger_or_balances(bank):
    for statement in [
        "UPDATE ledger_entries SET delta=1",
        "DELETE FROM journals",
        "UPDATE accounts SET posted_balance=0",
        "UPDATE audit_logs SET action='tampered'",
    ]:
        with pytest.raises(DBAPIError), bank.app.state.db.transaction() as s:
            s.execute(text(statement))
    assert bank.balance()["posted_balance"] == "3000000000"


def test_unbalanced_journal_is_rejected_at_commit(bank):
    with pytest.raises(DBAPIError), bank.owner.begin() as s:
        s.execute(
            text("INSERT INTO journals(id,transaction_id) VALUES(:id,:tx)"),
            {"id": str(uuid4()), "tx": str(uuid4())},
        )
    # A real command with no journal is needed to prove the deferred balancing constraint, not just its FK.
    held = bank.money("deposits", "1000000001").json()["data"]
    with pytest.raises(DBAPIError, match="unbalanced journal"), bank.owner.begin() as s:
        s.execute(
            text("INSERT INTO journals(id,transaction_id) VALUES(:id,:tx)"),
            {"id": str(uuid4()), "tx": held["id"]},
        )


def test_restore_style_reconciliation_and_corruption_gate(bank):
    bank.money("deposits", "1000")
    bank.money("transfers", "1000", role="alice")
    assert not reconcile(bank.app.state.db.engine.url.render_as_string(hide_password=False))
    with bank.owner.begin() as s:
        s.execute(
            text("UPDATE accounts SET posted_balance=posted_balance+1 WHERE id=:id"),
            {"id": sid(21)},
        )
    r = bank.client("alice").get("/api/v1/health/ready")
    assert r.status_code == 503
    bank.money("withdrawals", "1000", expected=503)
    # Restore the deliberate owner-only corruption to leave a reconciled disposable fixture.
    with bank.owner.begin() as s:
        s.execute(
            text("UPDATE accounts SET posted_balance=posted_balance-1 WHERE id=:id"),
            {"id": sid(21)},
        )


def test_api_route_inventory_matches_canonical_contract(bank):
    actual = {
        (r.path, m, r.operation_id)
        for r in bank.app.routes
        if hasattr(r, "operation_id")
        for m in r.methods
    }
    expected = {
        (p, m.upper(), op["operationId"])
        for p, methods in SPEC["paths"].items()
        for m, op in methods.items()
    }
    assert actual == expected
    assert len(expected) == 41


def test_seed_is_idempotent_and_no_secrets_in_responses(bank):
    from banking.manage import seed

    seed(str(bank.owner.url.render_as_string(hide_password=False)))
    assert bank.sql("SELECT count(*) AS n FROM users")[0]["n"] == 5
    r = bank.request("admin", "GET", "/users", expected=200)
    assert "password_hash" not in r.text
    assert "token_hash" not in r.text
    assert (
        bank.request("alice", "GET", "/dashboard", expected=200).json()["data"][
            "managed_user_count"
        ]
        is None
    )


def test_reversal_insufficient_funds_stays_pending(bank):
    dep = bank.money("deposits", "1000000000").json()["data"]
    w = bank.money("withdrawals", "3999999999").json()["data"]
    bank.review(w["id"])
    rev = bank.request(
        "teller",
        "POST",
        f"/transactions/{dep['id']}/reversal-requests",
        {"reason": "Yêu cầu đảo khoản gửi tiền demo."},
        expected=201,
    ).json()["data"]
    bank.request(
        "analyst",
        "POST",
        f"/reversal-requests/{rev['id']}/review-decisions",
        {"decision": "approve", "reason": "Thử đảo khi tiền không còn đủ."},
        expected=409,
    )
    assert (
        bank.request("analyst", "GET", "/reversal-requests/" + rev["id"], expected=200).json()[
            "data"
        ]["status"]
        == "pending_review"
    )
    assert bank.balance()["posted_balance"] == "1"


def test_last_admin_guard_and_disabled_sessions(bank):
    bank.client("alice")
    bank.request(
        "admin",
        "PATCH",
        "/users/" + sid(13),
        {"enabled": False, "expected_version": 1, "reason": "Vô hiệu hóa user đang đăng nhập."},
        expected=200,
    )
    assert bank.client("alice").get("/api/v1/auth/session").status_code == 401


def test_review_uses_original_rule_snapshot(bank):
    held = bank.money("deposits", "1000000001").json()["data"]
    alert = bank.request("analyst", "GET", "/fraud-alerts", expected=200).json()["data"][0]
    bank.request(
        "admin",
        "POST",
        "/fraud-rule-versions",
        {
            "high_amount_vnd": "1",
            "distance_km": 1,
            "rapid_amount_vnd": "1",
            "rapid_seconds": 3600,
            "expected_version": 1,
            "reason": "Thay đổi luật sau khi lệnh bị giữ.",
        },
        expected=201,
    )
    bank.review(held["id"])
    current = bank.request("analyst", "GET", "/fraud-alerts/" + alert["id"], expected=200).json()[
        "data"
    ]
    assert current["rule_version"] == 1
    assert current["status"] == "approved"


def test_response_contract_validation_rejects_drift():
    from banking.security import ApiError

    with pytest.raises(ApiError):
        validate(
            {"$ref": "#/components/schemas/Transaction"},
            {"id": "wrong", "amount": 100},
            response=True,
        )


def test_live_endpoint_does_not_depend_on_database(bank):
    from dataclasses import replace

    from fastapi.testclient import TestClient

    from banking.api import create_app
    from banking.config import Settings

    cfg = replace(
        Settings.from_env(),
        database_url="postgresql+psycopg://nobody:nothing@127.0.0.1:65435/missing",
    )
    bad = create_app(cfg)
    with TestClient(bad) as c:
        assert c.get("/api/v1/health/live").status_code == 200
        assert c.get("/api/v1/health/ready").status_code == 503
    bad.state.db.engine.dispose()


def test_customer_and_branch_archive_constraints(bank):
    bank.request("teller", "DELETE", "/customers/" + sid(3), expected=409)
    bank.request(
        "admin",
        "PATCH",
        "/branches/" + sid(1),
        {"active": False, "expected_version": 1, "reason": "Đóng chi nhánh trước khi có lệnh."},
        expected=200,
    )
    bank.money("withdrawals", "1000", expected=409)


def test_database_rejects_half_location_even_with_owner_connection(bank):
    held = bank.money("deposits", "1000000001").json()["data"]
    with pytest.raises(DBAPIError, match="paired_location"), bank.owner.begin() as s:
        s.execute(text("UPDATE transactions SET longitude=NULL WHERE id=:id"), {"id": held["id"]})


def test_runtime_cannot_rewrite_command_amount(bank):
    t = bank.money("withdrawals", "1000").json()["data"]
    with pytest.raises(DBAPIError), bank.app.state.db.transaction() as s:
        s.execute(text("UPDATE transactions SET amount=1 WHERE id=:id"), {"id": t["id"]})
