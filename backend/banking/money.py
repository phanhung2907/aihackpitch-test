from datetime import timedelta

from sqlalchemy.orm import Session

from banking.contract import new_id, to_json
from banking.db import execute, one, required_one, rows
from banking.domain import MAX_MONEY, assess_fraud, parse_amount
from banking.security import ApiError, digest


def require[T](value: T | None, code="NOT_FOUND", status=404) -> T:
    if value is None or value is False:
        raise ApiError(status, code)
    return value


def audit(s: Session, actor: dict, action: str, kind: str, resource_id: str, request_id: str):
    execute(
        s,
        "INSERT INTO audit_logs(id,actor_id,action,resource_type,resource_id,request_id) VALUES(:id,:actor,:action,:kind,:resource,:request)",
        id=new_id(),
        actor=actor["id"],
        action=action,
        kind=kind,
        resource=resource_id,
        request=request_id,
    )


def lock_accounts(s: Session, account_ids: list) -> dict[str, dict]:
    found = {}
    for account_id in sorted(set(str(a) for a in account_ids if a)):
        found[account_id] = require(
            one(s, "SELECT * FROM accounts WHERE id=:id FOR UPDATE", id=account_id)
        )
    return found


def lock_customers(s: Session, account_ids: list, *, require_active=True) -> list[dict]:
    customers = set()
    for aid in account_ids:
        if aid:
            account = require(one(s, "SELECT customer_id FROM accounts WHERE id=:id", id=aid))
            if account["customer_id"]:
                customers.add(str(account["customer_id"]))
    locked = []
    for cid in sorted(customers):
        row = require(one(s, "SELECT * FROM customers WHERE id=:id FOR SHARE", id=cid))
        # Check status after acquiring the lock; archived owners cannot initiate money changes.
        if require_active and row["status"] != "active":
            raise ApiError(409, "CUSTOMER_ARCHIVED")
        locked.append(row)
    return locked


def begin_key(s: Session, actor: dict, key: str, method: str, path: str, body: dict) -> dict:
    fingerprint = digest(to_json({"method": method, "path": path, "body": body}))
    execute(
        s,
        "INSERT INTO idempotency_records(id,actor_id,key,request_hash) VALUES(:id,:actor,:key,:hash) ON CONFLICT(actor_id,key) DO NOTHING",
        id=new_id(),
        actor=actor["id"],
        key=key,
        hash=fingerprint,
    )
    item = require(
        one(
            s,
            "SELECT * FROM idempotency_records WHERE actor_id=:actor AND key=:key FOR UPDATE",
            actor=actor["id"],
            key=key,
        )
    )
    if item["request_hash"] != fingerprint:
        raise ApiError(409, "IDEMPOTENCY_CONFLICT")
    return item


def finish_key(s: Session, key: dict, kind: str, rid: str, status: int):
    execute(
        s,
        "UPDATE idempotency_records SET resource_type=:kind,resource_id=:rid,original_status=:status WHERE id=:id",
        kind=kind,
        rid=rid,
        status=status,
        id=key["id"],
    )


def transaction_view(s: Session, tid: str) -> dict:
    t = require(one(s, "SELECT * FROM transactions WHERE id=:id", id=tid))
    evaluation = one(s, "SELECT results FROM fraud_evaluations WHERE transaction_id=:id", id=tid)
    reversal = one(
        s,
        "SELECT id FROM reversal_requests WHERE original_transaction_id=:id AND status IN ('pending_review','posted')",
        id=tid,
    )
    return {
        **{
            k: t[k]
            for k in [
                "id",
                "type",
                "source_account_id",
                "destination_account_id",
                "status",
                "received_at",
                "created_at",
                "posted_at",
                "version",
            ]
        },
        "amount": str(t["amount"]),
        "currency": "VND",
        "fraud_reason_codes": [
            r["rule_id"] for r in evaluation["results"] if r["result"] == "matched"
        ]
        if evaluation
        else [],
        "reversal_request_id": reversal["id"] if reversal else None,
    }


def reversal_view(s: Session, rid: str) -> dict:
    return require(one(s, "SELECT * FROM reversal_requests WHERE id=:id", id=rid))


def account_view(a: dict) -> dict:
    return {
        **{
            k: a[k]
            for k in [
                "id",
                "number",
                "customer_id",
                "currency",
                "label",
                "status",
                "version",
                "created_at",
            ]
        },
        "posted_balance": str(a["posted_balance"]),
        "reserved_amount": str(a["reserved_amount"]),
        "available_balance": str(a["posted_balance"] - a["reserved_amount"]),
    }


def replay_view(s: Session, item: dict):
    if not item["resource_id"]:
        return None
    return (
        transaction_view(s, str(item["resource_id"]))
        if item["resource_type"] == "transaction"
        else reversal_view(s, str(item["resource_id"]))
    )


def assert_accounts_active(accounts: dict[str, dict]):
    if any(a["status"] != "active" for a in accounts.values()):
        raise ApiError(409, "ACCOUNT_NOT_ACTIVE")


def create_money(
    s: Session,
    actor: dict,
    kind: str,
    body: dict,
    key: str,
    path: str,
    request_id: str,
    received_at,
    *,
    fault_hook=None,
) -> tuple[dict, bool]:
    source = (
        body.get("source_account_id")
        if kind == "transfer"
        else body["account_id"]
        if kind == "withdrawal"
        else None
    )
    dest = (
        body.get("destination_account_id")
        if kind == "transfer"
        else body["account_id"]
        if kind == "deposit"
        else None
    )
    initiated = source or dest
    if source and source == dest:
        raise ApiError(409, "SELF_TRANSFER")
    branch = None
    if kind != "transfer":
        branch = require(
            one(s, "SELECT * FROM branches WHERE id=:id FOR SHARE", id=actor["branch_id"])
        )
    customers = lock_customers(s, [source, dest], require_active=False)
    item = begin_key(s, actor, key, "POST", path, body)
    replay = replay_view(s, item)
    if replay:
        if kind == "transfer":
            owner = require(one(s, "SELECT customer_id FROM accounts WHERE id=:id", id=source))
            if str(owner["customer_id"]) != str(actor["customer_id"]):
                raise ApiError(404, "NOT_FOUND")
        return replay, True
    if branch and not branch["active"]:
        raise ApiError(409, "BRANCH_DISABLED")
    if any(c["status"] != "active" for c in customers):
        raise ApiError(409, "CUSTOMER_ARCHIVED")
    clearing = require(one(s, "SELECT id FROM accounts WHERE kind='clearing'"))["id"]
    accounts = lock_accounts(s, [source, dest, clearing] if kind != "transfer" else [source, dest])
    assert_accounts_active(accounts)
    account = accounts[str(initiated)]
    if account["kind"] != "customer" or (
        kind == "transfer" and str(account["customer_id"]) != str(actor["customer_id"])
    ):
        raise ApiError(404, "NOT_FOUND")
    if dest and accounts[str(dest)]["kind"] != "customer":
        raise ApiError(404, "NOT_FOUND")
    amount = parse_amount(body["amount"])
    if (
        source
        and accounts[str(source)]["posted_balance"] - accounts[str(source)]["reserved_amount"]
        < amount
    ):
        raise ApiError(409, "INSUFFICIENT_FUNDS")
    if dest and accounts[str(dest)]["posted_balance"] + amount > MAX_MONEY:
        raise ApiError(409, "AMOUNT_OVERFLOW")
    sequence = required_one(
        s,
        "UPDATE accounts SET next_sequence=next_sequence+1 WHERE id=:id RETURNING next_sequence",
        id=initiated,
    )["next_sequence"]
    coord = (
        {"latitude": branch["latitude"], "longitude": branch["longitude"]}
        if branch
        else body.get("location")
    )
    loc_source = "branch" if branch else "demo_client" if coord else "unavailable"
    tid = new_id()
    current = {
        "id": tid,
        "amount": amount,
        "received_at": received_at,
        "account_sequence": sequence,
        "latitude": coord["latitude"] if coord else None,
        "longitude": coord["longitude"] if coord else None,
        "location_source": loc_source,
    }
    rules = require(
        one(
            s,
            "SELECT r.* FROM rule_versions r JOIN rule_configuration c ON c.active_version_id=r.id WHERE c.id=1",
        )
    )
    # Bounded query: only the latest location candidate and high-value candidates in the time window.
    latest = one(
        s,
        "SELECT * FROM transactions WHERE initiated_account_id=:id AND status IN ('posted','pending_review') ORDER BY account_sequence DESC LIMIT 1",
        id=initiated,
    )
    history = rows(
        s,
        "SELECT * FROM transactions WHERE initiated_account_id=:id AND status IN ('posted','pending_review') AND amount>:amount AND received_at BETWEEN :start AND :end",
        id=initiated,
        amount=rules["rapid_amount_vnd"],
        start=received_at - timedelta(seconds=rules["rapid_seconds"]),
        end=received_at + timedelta(seconds=rules["rapid_seconds"]),
    )
    if latest and not any(h["id"] == latest["id"] for h in history):
        history.append(latest)
    assessment = assess_fraud(current, history, rules)
    execute(
        s,
        "INSERT INTO transactions(id,type,source_account_id,destination_account_id,initiated_account_id,actor_id,branch_id,amount,status,received_at,account_sequence,latitude,longitude,location_source) VALUES(:id,:kind,:source,:dest,:initiated,:actor,:branch,:amount,'pending_review',:received,:sequence,:latitude,:longitude,:loc_source)",
        id=tid,
        kind=kind,
        source=source,
        dest=dest,
        initiated=initiated,
        actor=actor["id"],
        branch=actor["branch_id"] if branch else None,
        amount=amount,
        received=received_at,
        sequence=sequence,
        latitude=current["latitude"],
        longitude=current["longitude"],
        loc_source=loc_source,
    )
    execute(
        s,
        "INSERT INTO fraud_evaluations(id,transaction_id,rule_version_id,outcome,results) VALUES(:id,:tx,:rules,:outcome,CAST(:results AS jsonb))",
        id=new_id(),
        tx=tid,
        rules=rules["id"],
        outcome=assessment["outcome"],
        results=to_json(assessment["results"]),
    )
    if assessment["outcome"] == "hold":
        execute(s, "SELECT hold_command(:id)", id=tid)
        execute(
            s,
            "INSERT INTO fraud_alerts(id,transaction_id,status) VALUES(:id,:tx,'open')",
            id=new_id(),
            tx=tid,
        )
    else:
        execute(s, "SELECT post_command(:id)", id=tid)
    if fault_hook:
        fault_hook("after_money")
    audit(s, actor, "create_" + kind, "transaction", tid, request_id)
    finish_key(s, item, "transaction", tid, 201)
    return transaction_view(s, tid), False


def review_money(
    s: Session, actor: dict, tid: str, body: dict, key: str, path: str, request_id: str
) -> tuple[dict, bool]:
    t = require(one(s, "SELECT * FROM transactions WHERE id=:id", id=tid))
    if str(t["actor_id"]) == str(actor["id"]):
        raise ApiError(403, "SELF_REVIEW")
    lock_customers(s, [t["source_account_id"], t["destination_account_id"]])
    item = begin_key(s, actor, key, "POST", path, body)
    replay = replay_view(s, item)
    if replay:
        return replay, True
    clearing = require(one(s, "SELECT id FROM accounts WHERE kind='clearing'"))["id"]
    accounts = lock_accounts(s, [t["source_account_id"], t["destination_account_id"], clearing])
    t = require(one(s, "SELECT * FROM transactions WHERE id=:id FOR UPDATE", id=tid))
    require(t["status"] == "pending_review", "ALREADY_DECIDED", 409)
    if body["decision"] == "approve":
        assert_accounts_active(accounts)
        execute(s, "SELECT post_command(:id)", id=tid)
    else:
        execute(s, "SELECT reject_command(:id)", id=tid)
    execute(
        s,
        "INSERT INTO review_actions(id,transaction_id,analyst_id,decision,reason) VALUES(:id,:tx,:actor,:decision,:reason)",
        id=new_id(),
        tx=tid,
        actor=actor["id"],
        **body,
    )
    execute(
        s,
        "UPDATE fraud_alerts SET status=:status,resolved_at=clock_timestamp() WHERE transaction_id=:id",
        status="approved" if body["decision"] == "approve" else "rejected",
        id=tid,
    )
    audit(s, actor, body["decision"], "transaction", tid, request_id)
    finish_key(s, item, "transaction", tid, 200)
    return transaction_view(s, tid), False


def reversal(
    s: Session,
    actor: dict,
    tx_or_req: str,
    body: dict,
    key: str,
    path: str,
    request_id: str,
    *,
    review=False,
) -> tuple[dict, bool]:
    req = (
        require(one(s, "SELECT * FROM reversal_requests WHERE id=:id", id=tx_or_req))
        if review
        else None
    )
    tid = req["original_transaction_id"] if req else tx_or_req
    t = require(one(s, "SELECT * FROM transactions WHERE id=:id", id=tid))
    lock_customers(s, [t["source_account_id"], t["destination_account_id"]])
    item = begin_key(s, actor, key, "POST", path, body)
    replay = replay_view(s, item)
    if replay:
        return replay, True
    entries = rows(
        s,
        "SELECT e.account_id FROM ledger_entries e JOIN journals j ON j.id=e.journal_id WHERE j.transaction_id=:id",
        id=tid,
    )
    lock_accounts(s, [e["account_id"] for e in entries])
    t = require(one(s, "SELECT * FROM transactions WHERE id=:id FOR UPDATE", id=tid))
    require(t["status"] == "posted", "INVALID_REVERSAL_STATE", 409)
    if not review:
        if one(
            s,
            "SELECT id FROM reversal_requests WHERE original_transaction_id=:id AND status IN ('pending_review','posted')",
            id=tid,
        ):
            raise ApiError(409, "REVERSAL_EXISTS")
        rid = new_id()
        execute(
            s,
            "INSERT INTO reversal_requests(id,original_transaction_id,requested_by,reason,status) VALUES(:id,:tx,:actor,:reason,'pending_review')",
            id=rid,
            tx=tid,
            actor=actor["id"],
            reason=body["reason"],
        )
    else:
        req = require(req)
        rid = str(req["id"])
        req = require(one(s, "SELECT * FROM reversal_requests WHERE id=:id FOR UPDATE", id=rid))
        require(req["status"] == "pending_review", "ALREADY_DECIDED", 409)
        if str(req["requested_by"]) == str(actor["id"]):
            raise ApiError(403, "SELF_REVIEW")
        if body["decision"] == "approve":
            execute(s, "SELECT post_reversal(:id)", id=rid)
        else:
            execute(s, "UPDATE reversal_requests SET status='rejected' WHERE id=:id", id=rid)
        execute(
            s,
            "UPDATE reversal_requests SET analyst_id=:actor,review_reason=:reason WHERE id=:id",
            actor=actor["id"],
            reason=body["reason"],
            id=rid,
        )
    audit(
        s,
        actor,
        "review_reversal" if review else "request_reversal",
        "reversal_request",
        rid,
        request_id,
    )
    finish_key(s, item, "reversal", rid, 200 if review else 201)
    return reversal_view(s, rid), False
