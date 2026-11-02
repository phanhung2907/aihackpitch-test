import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from banking.manage import sid


def test_auth_session_csrf_logout_and_ownership(bank):
    c = bank.client("alice")
    assert c.get("/api/v1/auth/session").json()["data"]["user"]["role"] == "customer"
    assert c.get("/api/v1/accounts/" + bank.ids["bob"]).status_code == 404
    assert c.get("/api/v1/accounts").json()["data"][0]["customer_id"] == sid(3)
    assert c.get("/api/v1/users").status_code == 403
    r = c.post(
        "/api/v1/transfers",
        json={
            "source_account_id": bank.ids["alice"],
            "destination_account_id": bank.ids["bob"],
            "amount": "1000",
            "location": None,
        },
        headers={"X-CSRF-Token": "wrong", "Idempotency-Key": str(uuid4())},
    )
    assert r.status_code == 403
    assert c.delete("/api/v1/auth/session").status_code == 204
    assert c.get("/api/v1/accounts").status_code == 401


def test_login_failure_throttle_and_origin(bank):
    c = TestClient(bank.app)
    body = {"login": "alice", "password": "incorrect"}
    assert c.post("/api/v1/auth/login", json=body).status_code == 403
    for _ in range(5):
        assert (
            c.post(
                "/api/v1/auth/login", headers={"Origin": "http://testserver"}, json=body
            ).status_code
            == 401
        )
    assert (
        c.post("/api/v1/auth/login", headers={"Origin": "http://testserver"}, json=body).status_code
        == 429
    )


def test_customer_crud_and_account_lifecycle(bank):
    customer = bank.request(
        "teller",
        "POST",
        "/customers",
        {"full_name": "Demo C", "email": "new@example.test", "phone": "0900000001"},
        expected=201,
    ).json()["data"]
    cid = customer["id"]
    changed = bank.request(
        "teller",
        "PATCH",
        "/customers/" + cid,
        {"full_name": "Demo Changed", "expected_version": 1},
        expected=200,
    ).json()["data"]
    assert changed["version"] == 2
    bank.request(
        "teller",
        "PATCH",
        "/customers/" + cid,
        {"full_name": "Stale", "expected_version": 1},
        expected=409,
    )
    account = bank.request(
        "teller", "POST", "/accounts", {"customer_id": cid, "label": "New"}, expected=201
    ).json()["data"]
    bank.request("teller", "DELETE", "/customers/" + cid, expected=409)
    updated = bank.request(
        "teller",
        "PATCH",
        "/accounts/" + account["id"],
        {"label": "Changed", "expected_version": 1},
        expected=200,
    ).json()["data"]
    for state in ["frozen", "active", "closed"]:
        updated = bank.request(
            "teller",
            "POST",
            "/accounts/" + account["id"] + "/state-changes",
            {
                "target_state": state,
                "expected_version": updated["version"],
                "reason": "Thay đổi trạng thái tài khoản demo.",
            },
            expected=200,
        ).json()["data"]
    bank.request(
        "teller",
        "POST",
        "/accounts/" + account["id"] + "/state-changes",
        {
            "target_state": "active",
            "expected_version": updated["version"],
            "reason": "Thử mở lại tài khoản đã đóng.",
        },
        expected=409,
    )
    bank.request("teller", "DELETE", "/customers/" + cid, expected=204)
    assert (
        bank.request("teller", "GET", "/customers/" + cid, expected=200).json()["data"]["status"]
        == "archived"
    )
    bank.request(
        "teller", "POST", "/accounts", {"customer_id": cid, "label": "Forbidden"}, expected=409
    )


def test_deposit_withdraw_transfer_and_history(bank):
    assert bank.money("deposits", "1000").json()["data"]["status"] == "posted"
    assert bank.money("withdrawals", "2000").json()["data"]["status"] == "posted"
    t = bank.money("transfers", "3000", role="alice").json()["data"]
    assert t["status"] == "posted"
    assert bank.balance()["posted_balance"] == "2999996000"
    assert bank.balance("bob")["posted_balance"] == "3000003000"
    assert (
        bank.request("alice", "GET", "/transactions/" + t["id"], expected=200).json()["data"][
            "amount"
        ]
        == "3000"
    )
    assert (
        bank.request("bob", "GET", "/transactions/" + t["id"], expected=200).json()["data"]["type"]
        == "transfer"
    )
    assert (
        bank.request("alice", "GET", "/dashboard", expected=200).json()["data"][
            "total_posted_balance"
        ]
        == "2999996000"
    )
    bank.money("withdrawals", "4000000000", expected=409)


@pytest.mark.parametrize("kind", ["deposits", "withdrawals", "transfers"])
def test_high_amount_hold_approve_and_reserve(bank, kind):
    t = bank.money(kind, "1000000001", role="alice" if kind == "transfers" else "teller").json()[
        "data"
    ]
    assert t["status"] == "pending_review"
    assert "HIGH_AMOUNT" in t["fraud_reason_codes"]
    assert bank.balance()["posted_balance"] == "3000000000"
    assert bank.balance()["reserved_amount"] == ("0" if kind == "deposits" else "1000000001")
    approved = bank.review(t["id"]).json()["data"]
    assert approved["status"] == "posted"
    assert bank.balance()["reserved_amount"] == "0"
    assert bank.balance()["posted_balance"] == (
        "4000000001" if kind == "deposits" else "1999999999"
    )
    bank.review(t["id"], expected=409)


def test_hold_reject_and_frozen_approve(bank):
    t = bank.money("withdrawals", "1000000001").json()["data"]
    a = bank.balance()
    bank.request(
        "teller",
        "POST",
        "/accounts/" + a["id"] + "/state-changes",
        {
            "target_state": "frozen",
            "expected_version": a["version"],
            "reason": "Khóa tài khoản trước kiểm duyệt.",
        },
        expected=200,
    )
    bank.review(t["id"], expected=409)
    assert bank.balance()["reserved_amount"] == "1000000001"
    assert bank.review(t["id"], "reject").json()["data"]["status"] == "rejected"
    assert bank.balance()["available_balance"] == "3000000000"


def test_rapid_and_distant_missing_location(bank):
    first = bank.money("withdrawals", "500000001").json()["data"]
    assert first["status"] == "posted"
    bank.advance(30)
    t = bank.money("withdrawals", "500000001").json()["data"]
    assert "RAPID_LARGE_TRANSACTIONS" in t["fraud_reason_codes"]
    bank.review(t["id"], "reject")
    bank.advance(31)
    far = bank.money(
        "transfers", "1000", role="alice", location={"latitude": 10.8231, "longitude": 106.6297}
    ).json()["data"]
    assert "DISTANT_LOCATIONS" in far["fraud_reason_codes"]
    bank.review(far["id"], "reject")
    missing = bank.money("transfers", "1000", role="alice", location=None).json()["data"]
    assert "LOCATION_UNAVAILABLE" in missing["fraud_reason_codes"]


def test_idempotent_replay_current_resource_and_conflict(bank):
    key = str(uuid4())
    first = bank.money("withdrawals", "1000000001", key=key).json()["data"]
    replay = bank.money("withdrawals", "1000000001", key=key)
    assert replay.headers["Idempotency-Replayed"] == "true"
    assert replay.json()["data"]["id"] == first["id"]
    bank.review(first["id"])
    assert bank.money("withdrawals", "1000000001", key=key).json()["data"]["status"] == "posted"
    bank.money("withdrawals", "1000000002", key=key, expected=409)
    assert (
        bank.sql("SELECT count(*) AS n FROM journals WHERE transaction_id=:id", id=first["id"])[0][
            "n"
        ]
        == 1
    )


@pytest.mark.parametrize("kind", ["deposits", "withdrawals", "transfers"])
def test_reversal_preserves_original_and_restores_balances(bank, kind):
    t = bank.money(kind, "12345", role="alice" if kind == "transfers" else "teller").json()["data"]
    r = bank.request(
        "teller",
        "POST",
        f"/transactions/{t['id']}/reversal-requests",
        {"reason": "Giao dịch demo bị nhập nhầm."},
        expected=201,
    ).json()["data"]
    result = bank.request(
        "analyst",
        "POST",
        f"/reversal-requests/{r['id']}/review-decisions",
        {"decision": "approve", "reason": "Đã xác minh yêu cầu đảo giao dịch."},
        expected=200,
    ).json()["data"]
    assert result["status"] == "posted"
    assert bank.balance()["posted_balance"] == "3000000000"
    assert bank.balance("bob")["posted_balance"] == "3000000000"
    assert (
        bank.request("teller", "GET", f"/transactions/{t['id']}", expected=200).json()["data"][
            "status"
        ]
        == "reversed"
    )
    bank.request(
        "teller",
        "POST",
        f"/transactions/{t['id']}/reversal-requests",
        {"reason": "Thử đảo cùng giao dịch lần hai."},
        expected=409,
    )


def test_admin_users_rules_branches_and_audit(bank):
    bank.client("admin")
    branch = bank.request(
        "admin",
        "POST",
        "/branches",
        {"code": "DN", "name": "Đà Nẵng", "location": {"latitude": 16.05, "longitude": 108.2}},
        expected=201,
    ).json()["data"]
    bank.request(
        "admin",
        "PATCH",
        "/branches/" + branch["id"],
        {"active": False, "expected_version": 1, "reason": "Tạm đóng chi nhánh mô phỏng."},
        expected=200,
    )
    user = bank.request(
        "admin",
        "POST",
        "/users",
        {
            "login": "newanalyst",
            "password": os.environ["DEMO_PASSWORD"],
            "role": "fraud_analyst",
            "customer_id": None,
            "branch_id": None,
        },
        expected=201,
    ).json()["data"]
    bank.request(
        "admin",
        "PATCH",
        "/users/" + user["id"],
        {"enabled": False, "expected_version": 1, "reason": "Vô hiệu hóa người dùng mô phỏng."},
        expected=200,
    )
    bank.request(
        "admin",
        "PATCH",
        "/users/" + sid(10),
        {"enabled": False, "expected_version": 1, "reason": "Thử vô hiệu hóa quản trị cuối."},
        expected=409,
    )
    rv = bank.request(
        "admin",
        "POST",
        "/fraud-rule-versions",
        {
            "high_amount_vnd": "1000000000",
            "distance_km": 500,
            "rapid_amount_vnd": "500000000",
            "rapid_seconds": 30,
            "expected_version": 1,
            "reason": "Tạo phiên bản luật cho kiểm thử.",
        },
        expected=201,
    ).json()["data"]
    assert rv["version"] == 2
    assert bank.request("admin", "GET", "/audit-logs", expected=200).json()["data"]


def test_lists_health_pagination_and_validation(bank):
    for role, path in [
        ("admin", "/users"),
        ("admin", "/branches"),
        ("admin", "/fraud-rule-versions"),
        ("teller", "/customers"),
        ("teller", "/accounts"),
        ("analyst", "/fraud-alerts"),
        ("analyst", "/reversal-requests"),
    ]:
        bank.request(role, "GET", path, expected=200)
    r = bank.request("alice", "GET", "/transactions?limit=1", expected=200).json()
    assert r["meta"]["next_cursor"] is None
    bank.money("deposits", "1000")
    r = bank.request("alice", "GET", "/transactions?limit=1", expected=200).json()
    cursor = r["meta"]["next_cursor"]
    assert cursor
    bank.request("alice", "GET", "/transactions?limit=1&cursor=" + cursor, expected=200)
    bank.request("bob", "GET", "/transactions?limit=1&cursor=" + cursor, expected=422)
    bank.request("alice", "GET", "/accounts?unexpected=1", expected=422)
    bank.money("deposits", "0", expected=422)
    bank.money(
        "transfers", "1000", role="alice", location={"latitude": 91, "longitude": 0}, expected=422
    )
    public = TestClient(bank.app)
    assert public.get("/api/v1/health/live").status_code == 200
    assert public.get("/api/v1/health/ready").status_code == 200


def test_fault_injection_rolls_back_entire_money_transaction(bank):
    before = bank.balance()

    def fail(_):
        raise RuntimeError("deliberate test failure")

    bank.app.state.fault_hook = fail
    bank.money("withdrawals", "1000", expected=500)
    bank.app.state.fault_hook = None
    assert bank.balance()["posted_balance"] == before["posted_balance"]
    assert (
        bank.sql(
            "SELECT count(*) AS n FROM transactions WHERE actor_id=:id AND received_at>clock_timestamp()-interval '1 hour'",
            id=sid(11),
        )[0]["n"]
        == 0
    )


def test_session_expiry_and_rotation(bank):
    c = bank.client("alice")
    old_cookie = c.cookies.get("bank_session")
    r = c.post(
        "/api/v1/auth/login", json={"login": "alice", "password": os.environ["DEMO_PASSWORD"]}
    )
    assert r.status_code == 200
    assert c.cookies.get("bank_session") != old_cookie
    stale = TestClient(bank.app)
    stale.cookies.set("bank_session", old_cookie)
    assert stale.get("/api/v1/auth/session").status_code == 401
    with bank.owner.begin() as s:
        from sqlalchemy import text

        s.execute(
            text(
                "UPDATE sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=:id"
            ),
            {"id": sid(13)},
        )
    assert c.get("/api/v1/auth/session").status_code == 401


def test_wrong_owner_forged_fields_and_overflow(bank):
    bank.money(
        "transfers",
        "1000",
        role="alice",
        source_account_id=bank.ids["bob"],
        destination_account_id=bank.ids["alice"],
        expected=404,
    )
    bank.money(
        "transfers", "1000", role="alice", destination_account_id=bank.ids["alice"], expected=409
    )
    bank.money("deposits", "9223372036854775808", expected=422)
    bank.money("deposits", "9223372036854775807", expected=409)
    bank.money("deposits", "1000", branch_id=sid(2), expected=422)
    account = bank.balance()
    bank.request(
        "teller",
        "PATCH",
        "/accounts/" + account["id"],
        {"label": "Bad", "posted_balance": "0", "expected_version": account["version"]},
        expected=422,
    )


def test_replay_still_returns_resource_after_freeze(bank):
    key = str(uuid4())
    t = bank.money("withdrawals", "1000", key=key).json()["data"]
    a = bank.balance()
    bank.request(
        "teller",
        "POST",
        "/accounts/" + a["id"] + "/state-changes",
        {
            "target_state": "frozen",
            "expected_version": a["version"],
            "reason": "Khóa sau khi đã ghi sổ giao dịch.",
        },
        expected=200,
    )
    assert bank.money("withdrawals", "1000", key=key).json()["data"]["id"] == t["id"]
    bank.money("withdrawals", "1000", expected=409)


def test_review_self_actor_is_forbidden_even_after_role_change(bank):
    held = bank.money("withdrawals", "1000000001").json()["data"]
    bank.request(
        "admin",
        "PATCH",
        "/users/" + sid(11),
        {
            "role": "fraud_analyst",
            "branch_id": None,
            "expected_version": 1,
            "reason": "Đổi vai trò để thử chống tự duyệt.",
        },
        expected=200,
    )
    bank.clients.pop("teller").close()
    bank.request(
        "teller",
        "POST",
        f"/transactions/{held['id']}/review-decisions",
        {"decision": "approve", "reason": "Thử tự duyệt lệnh đã tạo trước đó."},
        expected=403,
    )


def test_get_resources_recipient_filters_and_error_envelopes(bank):
    bank.request("admin", "GET", "/users/" + sid(10), expected=200)
    bank.request("admin", "GET", "/branches/" + sid(1), expected=200)
    bank.request("admin", "GET", "/fraud-rule-versions/" + sid(30), expected=200)
    recipient = bank.request(
        "alice", "GET", "/accounts/recipient-lookup?account_number=1000000022", expected=200
    ).json()["data"]
    assert set(recipient) == {"account_id", "account_number", "display_name"}
    bank.request("teller", "GET", "/customers?search=example.test&status=active", expected=200)
    bank.request(
        "alice",
        "GET",
        "/transactions?from=2026-11-03T01:00:00Z&to=2026-11-02T01:00:00Z",
        expected=422,
    )
    bank.request("alice", "GET", "/accounts/not-a-uuid", expected=422)
    r = bank.client("alice").get("/api/v1/does-not-exist")
    assert r.status_code == 404 and "request_id" in r.json()["error"]
    r = bank.client("teller").post(
        "/api/v1/deposits",
        content="{not JSON",
        headers={"Content-Type": "application/json", "Idempotency-Key": str(uuid4())},
    )
    assert r.status_code == 422
