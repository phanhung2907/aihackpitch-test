from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from banking.contract import new_id
from banking.db import execute, one, required_one, rows
from banking.domain import now
from banking.money import account_view, audit, require, reversal_view, transaction_view
from banking.security import PASSWORDS, ApiError, decode_cursor, digest, encode_cursor

USER_FIELDS = ["id", "login", "role", "customer_id", "branch_id", "enabled", "version"]


def user_view(user: dict) -> dict:
    return {k: user[k] for k in USER_FIELDS}


def branch_view(row: dict) -> dict:
    return {
        **{k: row[k] for k in ["id", "code", "name", "active", "version"]},
        "location": {"latitude": row["latitude"], "longitude": row["longitude"]},
    }


def rule_view(row: dict) -> dict:
    return {
        **{k: row[k] for k in ["id", "version", "distance_km", "rapid_seconds", "created_at"]},
        "high_amount_vnd": str(row["high_amount_vnd"]),
        "rapid_amount_vnd": str(row["rapid_amount_vnd"]),
    }


def alert_view(s, aid):
    a = require(
        one(
            s,
            "SELECT a.*,e.results,r.version AS rule_version FROM fraud_alerts a JOIN fraud_evaluations e ON e.transaction_id=a.transaction_id JOIN rule_versions r ON r.id=e.rule_version_id WHERE a.id=:id",
            id=aid,
        )
    )
    return a


def insert(s: Session, table: str, values: dict) -> dict:
    # table/column identifiers come only from this module's fixed call sites, never user input.
    columns = ",".join(values)
    placeholders = ",".join(":" + k for k in values)
    return require(
        one(s, f"INSERT INTO {table}({columns}) VALUES({placeholders}) RETURNING *", **values)
    )


def update(s: Session, table: str, rid: str, values: dict) -> dict:
    clauses = ",".join(k + "=:" + k for k in values)
    return require(
        one(
            s,
            f"UPDATE {table} SET {clauses},version=version+1 WHERE id=:rid RETURNING *",
            rid=rid,
            **values,
        )
    )


def scoped_account(s: Session, actor: dict, aid: str, lock=False) -> dict:
    a = require(
        one(
            s,
            "SELECT * FROM accounts WHERE id=:id AND kind='customer'"
            + (" FOR UPDATE" if lock else ""),
            id=aid,
        )
    )
    if actor["role"] == "customer" and str(a["customer_id"]) != str(actor["customer_id"]):
        raise ApiError(404, "NOT_FOUND")
    return a


def check_version(row, body):
    require(row["version"] == body["expected_version"], "STALE_VERSION", 409)


def map_user(s: Session, body: dict, current=None):
    combined = {**(current or {}), **body}
    role = combined["role"]
    customer = combined.get("customer_id")
    branch = combined.get("branch_id")
    if (
        (role == "customer" and (not customer or branch))
        or (role == "teller" and (not branch or customer))
        or (role in ["admin", "fraud_analyst"] and (customer or branch))
    ):
        raise ApiError(422, "INVALID_ROLE_MAPPING")
    if customer:
        require(
            one(
                s,
                "SELECT id FROM customers WHERE id=:id AND status='active' FOR SHARE",
                id=customer,
            ),
            "INVALID_CUSTOMER",
            422,
        )
    if branch:
        require(
            one(s, "SELECT id FROM branches WHERE id=:id AND active FOR SHARE", id=branch),
            "INVALID_BRANCH",
            422,
        )


def crud(s: Session, actor: dict, op: str, body: dict, params: dict, request_id: str):
    if op == "createCustomer":
        row = insert(
            s, "customers", {"id": new_id(), **body, "email": body["email"].strip().lower()}
        )
        audit(s, actor, op, "customer", row["id"], request_id)
        return row
    if op in ["getCustomer", "updateCustomer", "archiveCustomer"]:
        cid = params["customer_id"]
        row = require(
            one(
                s,
                "SELECT * FROM customers WHERE id=:id"
                + (" FOR UPDATE" if op != "getCustomer" else ""),
                id=cid,
            )
        )
        if actor["role"] == "customer" and str(row["id"]) != str(actor["customer_id"]):
            raise ApiError(404, "NOT_FOUND")
        if op == "getCustomer":
            return row
        if op == "archiveCustomer":
            if one(
                s,
                "SELECT id FROM accounts WHERE customer_id=:id AND status<>'closed' LIMIT 1",
                id=cid,
            ):
                raise ApiError(409, "CUSTOMER_HAS_ACTIVE_ACCOUNTS")
            execute(
                s,
                "UPDATE customers SET status='archived',version=version+1 WHERE id=:id AND status<>'archived'",
                id=cid,
            )
            audit(s, actor, op, "customer", cid, request_id)
            return None
        check_version(row, body)
        changes = {k: v for k, v in body.items() if k != "expected_version"}
        require(bool(changes), "EMPTY_UPDATE", 422)
        if "email" in changes:
            changes["email"] = changes["email"].strip().lower()
        row = update(s, "customers", cid, changes)
        audit(s, actor, op, "customer", cid, request_id)
        return row
    if op == "createAccount":
        require(
            one(
                s,
                "SELECT id FROM customers WHERE id=:id AND status='active' FOR SHARE",
                id=body["customer_id"],
            ),
            "CUSTOMER_NOT_ACTIVE",
            409,
        )
        rid = new_id()
        row = insert(
            s,
            "accounts",
            {
                "id": rid,
                "number": str(int(rid.replace("-", ""), 16))[:20],
                "kind": "customer",
                **body,
            },
        )
        audit(s, actor, op, "account", rid, request_id)
        return account_view(row)
    if op in ["getAccount", "updateAccount", "changeAccountState"]:
        aid = params["account_id"]
        initial = scoped_account(s, actor, aid)
        require(
            one(s, "SELECT id FROM customers WHERE id=:id FOR SHARE", id=initial["customer_id"])
        )
        row = scoped_account(s, actor, aid, lock=op != "getAccount")
        if op == "getAccount":
            return account_view(row)
        check_version(row, body)
        if op == "updateAccount":
            row = update(s, "accounts", aid, {"label": body["label"]})
        else:
            target = body["target_state"]
            if row["status"] == "closed" and target != "closed":
                raise ApiError(409, "ACCOUNT_CLOSED")
            if target == "closed":
                pending = one(
                    s,
                    "SELECT id FROM transactions WHERE (source_account_id=:id OR destination_account_id=:id) AND status='pending_review' LIMIT 1",
                    id=aid,
                )
                rev = one(
                    s,
                    "SELECT r.id FROM reversal_requests r JOIN transactions t ON t.id=r.original_transaction_id WHERE (t.source_account_id=:id OR t.destination_account_id=:id) AND r.status='pending_review' LIMIT 1",
                    id=aid,
                )
                if row["posted_balance"] or row["reserved_amount"] or pending or rev:
                    raise ApiError(409, "ACCOUNT_NOT_EMPTY")
            row = update(s, "accounts", aid, {"status": target})
        audit(s, actor, op, "account", aid, request_id)
        return account_view(row)
    if op == "lookupRecipient":
        a = require(
            one(
                s,
                "SELECT a.id,a.number,c.full_name FROM accounts a JOIN customers c ON c.id=a.customer_id WHERE a.number=:number AND a.kind='customer' AND a.status='active' AND c.status='active'",
                number=params["account_number"],
            )
        )
        return {
            "account_id": a["id"],
            "account_number": a["number"],
            "display_name": a["full_name"].split()[0] + " ***",
        }
    if op == "createBranch":
        coords = body["location"]
        row = insert(
            s, "branches", {"id": new_id(), "code": body["code"], "name": body["name"], **coords}
        )
        audit(s, actor, op, "branch", row["id"], request_id)
        return branch_view(row)
    if op == "updateBranch":
        rid = params["branch_id"]
        old = require(one(s, "SELECT * FROM branches WHERE id=:id FOR UPDATE", id=rid))
        check_version(old, body)
        changes = {k: v for k, v in body.items() if k in ["name", "active"]}
        if "location" in body:
            changes.update(body["location"])
        require(changes, "EMPTY_UPDATE", 422)
        row = update(s, "branches", rid, changes)
        audit(s, actor, op, "branch", rid, request_id)
        return branch_view(row)
    if op == "getBranch":
        return branch_view(
            require(one(s, "SELECT * FROM branches WHERE id=:id", id=params["branch_id"]))
        )
    if op == "createUser":
        map_user(s, body)
        values = {k: v for k, v in body.items() if k != "password"}
        values["login"] = values["login"].strip().lower()
        row = insert(
            s,
            "users",
            {"id": new_id(), **values, "password_hash": PASSWORDS.hash(body["password"])},
        )
        audit(s, actor, op, "user", row["id"], request_id)
        return user_view(row)
    if op == "updateUser":
        rid = params["user_id"]
        old = require(one(s, "SELECT * FROM users WHERE id=:id FOR UPDATE", id=rid))
        check_version(old, body)
        map_user(s, body, old)
        if (
            old["role"] == "admin"
            and old["enabled"]
            and (body.get("role", "admin") != "admin" or body.get("enabled") is False)
        ):
            count = required_one(
                s, "SELECT count(*) AS n FROM users WHERE role='admin' AND enabled"
            )["n"]
            require(count > 1, "LAST_ADMIN", 409)
        changes = {
            k: v for k, v in body.items() if k in ["role", "customer_id", "branch_id", "enabled"]
        }
        require(changes, "EMPTY_UPDATE", 422)
        row = update(s, "users", rid, changes)
        execute(
            s,
            "UPDATE sessions SET revoked_at=clock_timestamp() WHERE user_id=:id AND revoked_at IS NULL",
            id=rid,
        )
        audit(s, actor, op, "user", rid, request_id)
        return user_view(row)
    if op == "getUser":
        return user_view(require(one(s, "SELECT * FROM users WHERE id=:id", id=params["user_id"])))
    if op == "createRuleVersion":
        current = require(one(s, "SELECT * FROM rule_configuration WHERE id=1 FOR UPDATE"))
        check_version(current, body)
        from banking.domain import parse_amount

        row = insert(
            s,
            "rule_versions",
            {
                "id": new_id(),
                "version": current["version"] + 1,
                "high_amount_vnd": parse_amount(body["high_amount_vnd"]),
                "rapid_amount_vnd": parse_amount(body["rapid_amount_vnd"]),
                "distance_km": body["distance_km"],
                "rapid_seconds": body["rapid_seconds"],
                "created_by": actor["id"],
            },
        )
        execute(
            s,
            "UPDATE rule_configuration SET active_version_id=:id,version=version+1 WHERE id=1",
            id=row["id"],
        )
        audit(s, actor, op, "rule_version", row["id"], request_id)
        return rule_view(row)
    if op == "getRuleVersion":
        return rule_view(
            require(
                one(s, "SELECT * FROM rule_versions WHERE id=:id", id=params["rule_version_id"])
            )
        )
    raise ApiError(500, "UNIMPLEMENTED_OPERATION")


def authorize_transaction(s, actor, tid):
    t = require(one(s, "SELECT * FROM transactions WHERE id=:id", id=tid))
    if actor["role"] == "customer":
        own = one(
            s,
            "SELECT id FROM accounts WHERE customer_id=:customer AND id IN (:source,:dest)",
            customer=actor["customer_id"],
            source=t["source_account_id"],
            dest=t["destination_account_id"],
        )
        if not own:
            raise ApiError(404, "NOT_FOUND")
    return transaction_view(s, tid)


def paginate(s: Session, actor: dict, op: str, query: dict, secret: str) -> dict:
    config = {
        "listCustomers": ("customers", "created_at", lambda r: r),
        "listAccounts": ("accounts", "created_at", account_view),
        "listTransactions": (
            "transactions",
            "created_at",
            lambda r: transaction_view(s, str(r["id"])),
        ),
        "listFraudAlerts": ("fraud_alerts", "created_at", lambda r: alert_view(s, r["id"])),
        "listReversalRequests": (
            "reversal_requests",
            "created_at",
            lambda r: reversal_view(s, r["id"]),
        ),
        "listUsers": ("users", None, user_view),
        "listBranches": ("branches", None, branch_view),
        "listRuleVersions": ("rule_versions", "created_at", rule_view),
        "listAuditLogs": ("audit_logs", "created_at", lambda r: r),
    }
    table, datecol, view = config[op]
    where = ["true"]
    params: dict[str, Any] = {}
    if table == "accounts":
        where.append("kind='customer'")
        if actor["role"] == "customer":
            where.append("customer_id=:owner")
            params["owner"] = actor["customer_id"]
    if table == "transactions" and actor["role"] == "customer":
        where.append(
            "(source_account_id IN (SELECT id FROM accounts WHERE customer_id=:owner) OR destination_account_id IN (SELECT id FROM accounts WHERE customer_id=:owner))"
        )
        params["owner"] = actor["customer_id"]
    allowed = {
        "customers": ["status"],
        "accounts": ["status", "customer_id"],
        "transactions": ["status", "type"],
        "fraud_alerts": ["status"],
        "reversal_requests": ["status"],
        "audit_logs": ["resource_id", "resource_type"],
    }.get(table, [])
    for key in allowed:
        if key in query:
            where.append(f"{key}=:{key}")
            params[key] = query[key]
    if table == "customers" and "search" in query:
        where.append("(full_name ILIKE :search OR email ILIKE :search)")
        params["search"] = "%" + query["search"] + "%"
    if table == "transactions":
        if "account_id" in query:
            where.append("(source_account_id=:aid OR destination_account_id=:aid)")
            params["aid"] = query["account_id"]
        for k, sign in [("from", ">="), ("to", "<=")]:
            if k in query:
                where.append(f"created_at{sign}:{k}")
                params[k] = query[k]
        if (
            "from" in query
            and "to" in query
            and datetime.fromisoformat(query["from"]) > datetime.fromisoformat(query["to"])
        ):
            raise ApiError(422, "INVALID_TIME_RANGE")
    scope = digest(
        str(actor["id"]) + op + str(sorted((k, v) for k, v in query.items() if k != "cursor"))
    )
    if "cursor" in query:
        decoded_cursor = decode_cursor(secret, query["cursor"], scope)
        params["last_id"] = decoded_cursor["id"]
        if datecol:
            where.append(f"({datecol},id)<(:last_date,:last_id)")
            params["last_date"] = decoded_cursor["created_at"]
        else:
            where.append("id<:last_id")
    limit = query.get("limit", 20)
    params["n"] = limit + 1
    order = f"{datecol} DESC,id DESC" if datecol else "id DESC"
    result = rows(
        s,
        f"SELECT * FROM {table} WHERE " + " AND ".join(where) + f" ORDER BY {order} LIMIT :n",
        **params,
    )
    more = len(result) > limit
    result = result[:limit]
    cursor = None
    if more and result:
        last = result[-1]
        cursor = encode_cursor(
            secret,
            {
                "scope": scope,
                "id": str(last["id"]),
                "created_at": last[datecol].isoformat() if datecol else "1970-01-01T00:00:00+00:00",
            },
        )
    return {"data": [view(r) for r in result], "meta": {"next_cursor": cursor, "limit": limit}}


def dashboard(s, actor):
    role = actor["role"]
    balance = None
    reserved = None
    alerts = None
    oldest = None
    managed = None
    if role == "customer":
        b = required_one(
            s,
            "SELECT coalesce(sum(posted_balance::numeric),0) AS balance,coalesce(sum(reserved_amount::numeric),0) AS reserved FROM accounts WHERE customer_id=:id",
            id=actor["customer_id"],
        )
        balance = str(b["balance"])
        reserved = str(b["reserved"])
        count = required_one(
            s,
            "SELECT count(*) AS n FROM transactions WHERE status IN ('posted','reversed') AND (source_account_id IN (SELECT id FROM accounts WHERE customer_id=:id) OR destination_account_id IN (SELECT id FROM accounts WHERE customer_id=:id))",
            id=actor["customer_id"],
        )["n"]
    elif role == "teller":
        count = required_one(
            s, "SELECT count(*) AS n FROM transactions WHERE status IN ('posted','reversed')"
        )["n"]
    else:
        count = 0
    if role == "fraud_analyst":
        a = required_one(
            s,
            "SELECT count(*) AS n,min(created_at) AS oldest FROM fraud_alerts WHERE status='open'",
        )
        alerts = a["n"]
        oldest = a["oldest"]
    if role == "admin":
        managed = required_one(s, "SELECT count(*) AS n FROM users")["n"]
    return {
        "role": role,
        "as_of": now(),
        "total_posted_balance": balance,
        "total_reserved_amount": reserved,
        "posted_transaction_count": count,
        "open_alert_count": alerts,
        "oldest_pending_at": oldest,
        "managed_user_count": managed,
    }
