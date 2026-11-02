import os
from dataclasses import replace
from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from banking.api import create_app
from banking.config import Settings, load_local_env
from banking.domain import now
from banking.manage import migrate, seed, sid


@pytest.fixture(scope="session")
def test_database():
    load_local_env()
    owner = os.environ.get("TEST_MIGRATION_DATABASE_URL")
    runtime = os.environ.get("TEST_DATABASE_URL")
    if not owner or not runtime:
        pytest.fail(
            "Set dedicated TEST_MIGRATION_DATABASE_URL and TEST_DATABASE_URL; tests never substitute SQLite"
        )
    if (
        not make_url(owner).database.endswith("_test")
        or make_url(owner).database != make_url(runtime).database
    ):
        raise RuntimeError(
            "Integration cleanup is allowed only on matching dedicated *_test databases"
        )
    previous = os.environ.get("MIGRATION_DATABASE_URL")
    migrate(owner)
    if previous:
        os.environ["MIGRATION_DATABASE_URL"] = previous
    yield owner, runtime


@pytest.fixture
def bank(test_database):
    owner, runtime = test_database
    engine = create_engine(owner)
    with engine.begin() as connection:
        tables = (
            connection.execute(
                text(
                    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'alembic_version' ORDER BY tablename"
                )
            )
            .scalars()
            .all()
        )
        # All identifiers are database metadata in an explicitly guarded disposable test database.
        connection.exec_driver_sql(
            "TRUNCATE " + ",".join('"' + t + '"' for t in tables) + " CASCADE"
        )
        connection.execute(text("INSERT INTO admin_guard VALUES(1)"))
    seed(owner)
    settings = replace(
        Settings.from_env(),
        database_url=runtime,
        origins=frozenset({"http://testserver"}),
        secure_cookie=False,
    )
    clock = [now()]
    app = create_app(settings, clock=lambda: clock[0])

    class Bank:
        def __init__(self):
            self.app = app
            self.clock = clock
            self.clients = {}
            self.owner = engine
            self.ids = {"alice": sid(21), "bob": sid(22)}

        def client(self, role):
            if role not in self.clients:
                c = TestClient(app, raise_server_exceptions=False)
                r = c.post(
                    "/api/v1/auth/login",
                    headers={"Origin": "http://testserver"},
                    json={"login": role, "password": os.environ["DEMO_PASSWORD"]},
                )
                assert r.status_code == 200, r.text
                c.headers.update(
                    {"Origin": "http://testserver", "X-CSRF-Token": r.json()["data"]["csrf_token"]}
                )
                self.clients[role] = c
            return self.clients[role]

        def request(self, role, method, path, body=None, key=None, expected=None):
            headers = {"Idempotency-Key": key or str(uuid4())}
            r = self.client(role).request(method, "/api/v1" + path, json=body, headers=headers)
            if expected is not None:
                assert r.status_code == expected, r.text
            return r

        def money(
            self,
            kind="withdrawals",
            amount="1000",
            role="teller",
            account="alice",
            key=None,
            expected=201,
            **extra,
        ):
            body = {"amount": amount}
            if kind == "transfers":
                body.update(
                    source_account_id=self.ids["alice"],
                    destination_account_id=self.ids["bob"],
                    location={"latitude": 21.0285, "longitude": 105.8542},
                )
            else:
                body["account_id"] = self.ids[account]
            body.update(extra)
            return self.request(role, "POST", "/" + kind, body, key, expected)

        def balance(self, account="alice"):
            return self.request(
                account, "GET", "/accounts/" + self.ids[account], expected=200
            ).json()["data"]

        def review(self, tid, decision="approve", expected=200, **kwargs):
            return self.request(
                "analyst",
                "POST",
                f"/transactions/{tid}/review-decisions",
                {"decision": decision, "reason": "Đã xác minh dữ liệu giao dịch demo."},
                expected=expected,
                **kwargs,
            )

        def sql(self, sql, **params):
            with engine.begin() as c:
                return [dict(r) for r in c.execute(text(sql), params).mappings()]

        def advance(self, seconds=31):
            self.clock[0] += timedelta(seconds=seconds)

    b = Bank()
    yield b
    for c in b.clients.values():
        c.close()
    app.state.db.engine.dispose()
    engine.dispose()
