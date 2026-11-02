import hmac
import json
import logging
import secrets
from collections.abc import Callable
from datetime import timedelta

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy.exc import DBAPIError, IntegrityError
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException as StarletteHTTPException

from banking.config import Settings
from banking.contract import SPEC, clean, new_id, validate
from banking.db import Database, execute, one, required_one
from banking.domain import now
from banking.money import create_money, reversal, review_money
from banking.resources import (
    alert_view,
    authorize_transaction,
    crud,
    dashboard,
    paginate,
    require,
    user_view,
)
from banking.security import DUMMY_HASH, ApiError, csrf_token, digest, verify_password

logger = logging.getLogger("banking")


class ContractFastAPI(FastAPI):
    def openapi(self) -> dict:
        """Serve the canonical boundary without relying on framework cache internals."""
        return SPEC


def create_app(settings: Settings | None = None, *, clock: Callable = now) -> FastAPI:
    settings = settings or Settings.from_env()
    db = Database(settings.database_url)
    app = ContractFastAPI(title="Banking Demo", docs_url="/docs", redoc_url=None)
    app.state.db = db
    app.state.fault_hook = None
    app.state.clock = clock
    # The checked-in contract is authoritative; route and runtime conformance are tested separately.

    def origin(request: Request):
        if request.headers.get("origin") not in settings.origins:
            raise ApiError(403, "ORIGIN_FORBIDDEN")

    @app.middleware("http")
    async def request_boundary(request: Request, call_next):
        request.state.request_id = new_id()
        request.state.received_at = app.state.clock()
        try:
            result = await call_next(request)
        except Exception:
            logger.error("Unhandled request failure; request_id=%s", request.state.request_id)
            result = JSONResponse(
                {
                    "error": {
                        "code": "INTERNAL_ERROR",
                        "message": "Internal server error",
                        "details": [],
                        "request_id": request.state.request_id,
                    }
                },
                500,
            )
        result.headers["X-Request-ID"] = request.state.request_id
        result.headers["Cache-Control"] = "no-store"
        result.headers["X-Content-Type-Options"] = "nosniff"
        return result

    @app.exception_handler(ApiError)
    async def api_error(request, exc):
        headers = {"Retry-After": "900"} if exc.status == 429 else {}
        return JSONResponse(
            {
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                    "request_id": request.state.request_id,
                }
            },
            exc.status,
            headers=headers,
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request, exc):
        return await api_error(
            request,
            ApiError(
                exc.status_code, "NOT_FOUND" if exc.status_code == 404 else "METHOD_NOT_ALLOWED"
            ),
        )

    def authenticate(s, request, operation):
        token = request.cookies.get("bank_session", "")
        session = one(
            s,
            "SELECT s.*,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=:hash AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND u.enabled",
            hash=digest(token),
        )
        if not session:
            if operation["operationId"] == "logout":
                return None, None
            raise ApiError(401, "AUTHENTICATION_REQUIRED")
        # Serialize admin mutations before acquiring user locks (including the caller's shared lock).
        if session["role"] == "admin" and request.method not in ["GET", "HEAD"]:
            one(s, "SELECT id FROM admin_guard WHERE id=1 FOR UPDATE")
        actor = require(
            one(
                s,
                "SELECT * FROM users WHERE id=:id AND enabled"
                + (" FOR SHARE" if request.method not in ["GET", "HEAD"] else ""),
                id=session["user_id"],
            ),
            "AUTHENTICATION_REQUIRED",
            401,
        )
        session = one(
            s,
            "SELECT * FROM sessions WHERE id=:id AND revoked_at IS NULL AND expires_at>clock_timestamp()",
            id=session["id"],
        )
        session = require(session, "AUTHENTICATION_REQUIRED", 401)
        if actor["role"] not in operation["x-roles"]:
            raise ApiError(403, "FORBIDDEN")
        if request.method not in ["GET", "HEAD"]:
            supplied = request.headers.get("x-csrf-token", "")
            if not hmac.compare_digest(supplied, csrf_token(settings.secret, str(session["id"]))):
                raise ApiError(403, "CSRF_FAILED")
        return actor, session

    def login(request, body):
        origin(request)
        throttle_key = digest(
            body["login"].strip().lower()
            + ":"
            + (request.client.host if request.client else "unknown")
        )
        failure = False
        result = None
        with db.transaction() as s:
            execute(
                s,
                "INSERT INTO login_throttles(key_hash,window_started_at) VALUES(:key,clock_timestamp()) ON CONFLICT DO NOTHING",
                key=throttle_key,
            )
            throttle = required_one(
                s, "SELECT * FROM login_throttles WHERE key_hash=:key FOR UPDATE", key=throttle_key
            )
            if throttle["blocked_until"] and throttle["blocked_until"] > now():
                raise ApiError(429, "LOGIN_THROTTLED")
            if throttle["window_started_at"] < now() - timedelta(minutes=15):
                execute(
                    s,
                    "UPDATE login_throttles SET failure_count=0,blocked_until=NULL,window_started_at=clock_timestamp() WHERE key_hash=:key",
                    key=throttle_key,
                )
                throttle["failure_count"] = 0
            user = one(
                s,
                "SELECT * FROM users WHERE login=:login FOR SHARE",
                login=body["login"].strip().lower(),
            )
            valid = verify_password(user["password_hash"] if user else DUMMY_HASH, body["password"])
            if not valid or not user or not user["enabled"]:
                failure = True
                execute(
                    s,
                    "UPDATE login_throttles SET failure_count=failure_count+1,blocked_until=CASE WHEN failure_count+1>=5 THEN clock_timestamp()+interval '15 minutes' ELSE NULL END WHERE key_hash=:key",
                    key=throttle_key,
                )
            else:
                execute(
                    s,
                    "UPDATE login_throttles SET failure_count=0,blocked_until=NULL WHERE key_hash=:key",
                    key=throttle_key,
                )
                old_token = request.cookies.get("bank_session", "")
                execute(
                    s,
                    "UPDATE sessions SET revoked_at=clock_timestamp() WHERE token_hash=:hash",
                    hash=digest(old_token),
                )
                token = secrets.token_urlsafe(32)
                sid = new_id()
                expires = now() + timedelta(hours=8)
                execute(
                    s,
                    "INSERT INTO sessions(id,token_hash,user_id,expires_at) VALUES(:id,:hash,:user,:expires)",
                    id=sid,
                    hash=digest(token),
                    user=user["id"],
                    expires=expires,
                )
                result = (
                    {
                        "user": user_view(user),
                        "csrf_token": csrf_token(settings.secret, sid),
                        "expires_at": expires,
                    },
                    token,
                )
        if failure:
            raise ApiError(401, "INVALID_CREDENTIALS")
        return result

    def dispatch(request, operation, body, params, query):
        op = operation["operationId"]
        code = next(int(k) for k in operation["responses"] if k.startswith("2"))
        replay = False
        token = None
        if op == "login":
            value, token = login(request, body)
            payload: dict | None = {"data": clean(value)}
            validate(
                operation["responses"][str(code)]["content"]["application/json"]["schema"],
                payload,
                response=True,
            )
        elif op == "healthLive":
            payload = {"data": {"status": "ok"}}
        else:
            with db.transaction() as s:
                if op == "getDashboard":
                    execute(s, "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
                if op in ["healthLive", "healthReady"]:
                    if op == "healthReady":
                        require(
                            one(
                                s, "SELECT version_num FROM alembic_version WHERE version_num='004'"
                            ),
                            "SCHEMA_NOT_READY",
                            503,
                        )
                        mismatch = one(
                            s,
                            "SELECT a.id FROM accounts a WHERE a.posted_balance::numeric<>COALESCE((SELECT SUM(delta::numeric) FROM ledger_entries WHERE account_id=a.id),0) OR a.reserved_amount::numeric<>COALESCE((SELECT SUM(amount::numeric) FROM reservations WHERE account_id=a.id AND state='active'),0) LIMIT 1",
                        )
                        if mismatch:
                            raise ApiError(503, "RECONCILIATION_FAILED")
                    value = {"status": "ok"}
                else:
                    if request.method not in ["GET", "HEAD"]:
                        origin(request)
                    actor, session = authenticate(s, request, operation)
                    if op in {
                        "createDeposit",
                        "createWithdrawal",
                        "createTransfer",
                        "reviewTransaction",
                        "requestReversal",
                        "reviewReversal",
                    }:
                        mismatch = one(
                            s,
                            "SELECT a.id FROM accounts a WHERE a.posted_balance::numeric<>COALESCE((SELECT SUM(delta::numeric) FROM ledger_entries WHERE account_id=a.id),0) OR a.reserved_amount::numeric<>COALESCE((SELECT SUM(amount::numeric) FROM reservations WHERE account_id=a.id AND state='active'),0) LIMIT 1",
                        )
                        if mismatch:
                            raise ApiError(503, "RECONCILIATION_FAILED")
                    if op == "getSession":
                        value = {
                            "user": user_view(actor),
                            "csrf_token": csrf_token(settings.secret, str(session["id"])),
                            "expires_at": session["expires_at"],
                        }
                    elif op == "logout":
                        if session:
                            execute(
                                s,
                                "UPDATE sessions SET revoked_at=clock_timestamp() WHERE id=:id",
                                id=session["id"],
                            )
                        value = None
                    elif op in ["createDeposit", "createWithdrawal", "createTransfer"]:
                        kinds = {
                            "createDeposit": "deposit",
                            "createWithdrawal": "withdrawal",
                            "createTransfer": "transfer",
                        }
                        value, replay = create_money(
                            s,
                            actor,
                            kinds[op],
                            body,
                            request.headers["idempotency-key"],
                            request.url.path,
                            request.state.request_id,
                            request.state.received_at,
                            fault_hook=app.state.fault_hook,
                        )
                    elif op == "reviewTransaction":
                        value, replay = review_money(
                            s,
                            actor,
                            params["transaction_id"],
                            body,
                            request.headers["idempotency-key"],
                            request.url.path,
                            request.state.request_id,
                        )
                    elif op in ["requestReversal", "reviewReversal"]:
                        review = op == "reviewReversal"
                        value, replay = reversal(
                            s,
                            actor,
                            params["reversal_id"] if review else params["transaction_id"],
                            body,
                            request.headers["idempotency-key"],
                            request.url.path,
                            request.state.request_id,
                            review=review,
                        )
                    elif op.startswith("list"):
                        payload = clean(paginate(s, actor, op, query, settings.secret))
                        validate(
                            operation["responses"][str(code)]["content"]["application/json"][
                                "schema"
                            ],
                            payload,
                            response=True,
                        )
                        return payload, code, replay, token
                    elif op == "getTransaction":
                        value = authorize_transaction(s, actor, params["transaction_id"])
                    elif op == "getFraudAlert":
                        value = alert_view(s, params["alert_id"])
                    elif op == "getReversalRequest":
                        from banking.money import reversal_view

                        value = reversal_view(s, params["reversal_id"])
                    elif op == "getDashboard":
                        value = dashboard(s, actor)
                    else:
                        value = crud(
                            s, actor, op, body, {**params, **query}, request.state.request_id
                        )
                payload = {"data": clean(value)} if code != 204 else None
                if payload is not None:
                    validate(
                        operation["responses"][str(code)]["content"]["application/json"]["schema"],
                        payload,
                        response=True,
                    )
                # Returning exits the transaction context first: commit must succeed before HTTP success.
        return payload, code, replay, token

    def handler_for(operation):
        async def endpoint(request: Request):
            params = dict(request.path_params)
            query: dict = dict(request.query_params)
            declared_queries = {
                p["name"] for p in operation.get("parameters", []) if p["in"] == "query"
            }
            if set(query) - declared_queries or any(
                len(request.query_params.getlist(k)) > 1 for k in query
            ):
                raise ApiError(422, "UNKNOWN_QUERY_PARAMETER")
            for parameter in operation.get("parameters", []):
                name, location = parameter["name"], parameter["in"]
                target = (
                    params
                    if location == "path"
                    else query
                    if location == "query"
                    else request.headers
                )
                lookup = name.lower() if location == "header" else name
                if lookup not in target:
                    if parameter.get("required"):
                        raise ApiError(422, "MISSING_PARAMETER")
                    continue
                value = target[lookup]
                if location == "query" and parameter["schema"].get("type") == "integer":
                    try:
                        value = int(value)
                        query[name] = value
                    except ValueError as exc:
                        raise ApiError(422, "INVALID_PARAMETER") from exc
                validate(parameter["schema"], value)
            body = {}
            if "requestBody" in operation:
                if request.headers.get("content-type", "").split(";")[0] != "application/json":
                    raise ApiError(422, "JSON_REQUIRED")
                raw = await request.body()
                if len(raw) > 1_048_576:
                    raise ApiError(422, "REQUEST_TOO_LARGE")
                try:
                    body = json.loads(
                        raw, parse_constant=lambda _: (_ for _ in ()).throw(ValueError())
                    )
                except (ValueError, UnicodeDecodeError) as exc:
                    raise ApiError(422, "INVALID_JSON") from exc
                validate(operation["requestBody"]["content"]["application/json"]["schema"], body)
            try:
                payload, status, replay, token = await run_in_threadpool(
                    dispatch, request, operation, body, params, query
                )
            except ValueError as exc:
                raise ApiError(422, "INVALID_VALUE") from exc
            except IntegrityError as exc:
                raise ApiError(409, "DATA_CONFLICT") from exc
            except DBAPIError as exc:
                error = str(exc.orig)
                known = next(
                    (
                        c
                        for c in [
                            "INSUFFICIENT_FUNDS",
                            "ACCOUNT_NOT_ACTIVE",
                            "ALREADY_DECIDED",
                            "AMOUNT_OVERFLOW",
                        ]
                        if c in error
                    ),
                    None,
                )
                raise ApiError(409 if known else 503, known or "DATABASE_UNAVAILABLE") from exc
            response = (
                JSONResponse(payload, status)
                if payload is not None
                else Response(status_code=status)
            )
            if operation["operationId"] == "login":
                response.set_cookie(
                    "bank_session",
                    token,
                    max_age=28800,
                    httponly=True,
                    samesite="lax",
                    secure=settings.secure_cookie,
                    path="/",
                )
            if operation["operationId"] == "logout":
                response.delete_cookie("bank_session", path="/")
            if any(p["name"] == "Idempotency-Key" for p in operation.get("parameters", [])):
                response.headers["Idempotency-Replayed"] = str(replay).lower()
            if status == 201:
                rid = payload["data"]["id"]
                op = operation["operationId"]
                collection = (
                    "transactions"
                    if op in ["createDeposit", "createWithdrawal", "createTransfer"]
                    else "reversal-requests"
                    if op == "requestReversal"
                    else request.url.path.split("/")[-1]
                )
                response.headers["Location"] = f"/api/v1/{collection}/{rid}"
            return response

        return endpoint

    for path, methods in SPEC["paths"].items():
        for method, operation in methods.items():
            app.add_api_route(
                path,
                handler_for(operation),
                methods=[method.upper()],
                operation_id=operation["operationId"],
                name=operation["operationId"],
            )
    return app
