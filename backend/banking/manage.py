import argparse
import os
from datetime import timedelta
from pathlib import Path

from alembic import command
from alembic.config import Config
from psycopg import sql
from sqlalchemy import create_engine

from banking.config import load_local_env
from banking.db import Database, execute, one
from banking.domain import now
from banking.security import PASSWORDS


def sid(n: int) -> str:
    return f"00000000-0000-4000-8000-{n:012d}"


def migrate(url: str | None = None) -> None:
    load_local_env()
    if url:
        os.environ["MIGRATION_DATABASE_URL"] = url
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.set_main_option(
        "script_location", str(Path(__file__).resolve().parents[1] / "migrations")
    )
    command.upgrade(config, "head")
    engine = create_engine(os.environ["MIGRATION_DATABASE_URL"])
    password = os.environ["BANK_APP_PASSWORD"]
    if len(password) < 20 or password.startswith("replace-"):
        raise RuntimeError("Configure a random BANK_APP_PASSWORD (at least 20 characters)")
    with engine.begin() as conn:
        raw = conn.connection.driver_connection
        assert raw is not None
        if not raw.execute("SELECT 1 FROM pg_roles WHERE rolname='bank_app'").fetchone():
            raw.execute(
                sql.SQL(
                    "CREATE ROLE bank_app LOGIN PASSWORD {} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT"
                ).format(sql.Literal(password))
            )
        else:
            raw.execute(sql.SQL("ALTER ROLE bank_app PASSWORD {}").format(sql.Literal(password)))
        raw.execute("GRANT USAGE ON SCHEMA public TO bank_app")
        raw.execute("GRANT UPDATE ON admin_guard TO bank_app")
        raw.execute("GRANT SELECT ON ALL TABLES IN SCHEMA public TO bank_app")
        raw.execute(
            "GRANT INSERT,UPDATE ON users,branches,customers,sessions,login_throttles,rule_configuration,transactions,fraud_alerts,reversal_requests,idempotency_records TO bank_app"
        )
        raw.execute(
            "GRANT INSERT ON rule_versions,fraud_evaluations,review_actions,audit_logs TO bank_app"
        )
        raw.execute(
            "GRANT INSERT(id,number,kind,customer_id,currency,label,status),UPDATE(label,status,next_sequence,version) ON accounts TO bank_app"
        )
        raw.execute(
            "GRANT EXECUTE ON FUNCTION hold_command(uuid),reject_command(uuid),post_command(uuid),post_reversal(uuid) TO bank_app"
        )
        raw.execute("REVOKE UPDATE ON transactions FROM bank_app")
        raw.execute("GRANT UPDATE(version) ON transactions TO bank_app")
    engine.dispose()


def seed(url: str | None = None):
    load_local_env()
    if os.environ.get("APP_ENV") != "development":
        raise RuntimeError("Seed is restricted to explicit development mode")
    password = os.environ.get("DEMO_PASSWORD", "")
    if len(password) < 12 or password.startswith("replace-"):
        raise RuntimeError("Configure DEMO_PASSWORD (at least 12 characters)")
    db = Database(url or os.environ["MIGRATION_DATABASE_URL"])
    with db.transaction() as s:
        if one(s, "SELECT id FROM users WHERE id=:id", id=sid(10)):
            return
        execute(
            s,
            "INSERT INTO branches(id,code,name,latitude,longitude) VALUES(:id,'HN','Hà Nội',21.0285,105.8542)",
            id=sid(1),
        )
        execute(
            s,
            "INSERT INTO branches(id,code,name,latitude,longitude) VALUES(:id,'HCM','TP.HCM',10.8231,106.6297)",
            id=sid(2),
        )
        for n, name in [(3, "Khách hàng A"), (4, "Khách hàng B")]:
            execute(
                s,
                "INSERT INTO customers(id,full_name,email,phone) VALUES(:id,:name,:email,'0900000000')",
                id=sid(n),
                name=name,
                email=f"customer{n}@example.test",
            )
        for n, login, role, customer, branch in [
            (10, "admin", "admin", None, None),
            (11, "teller", "teller", None, sid(1)),
            (12, "analyst", "fraud_analyst", None, None),
            (13, "alice", "customer", sid(3), None),
            (14, "bob", "customer", sid(4), None),
        ]:
            execute(
                s,
                "INSERT INTO users(id,login,password_hash,role,customer_id,branch_id) VALUES(:id,:login,:password,:role,:customer,:branch)",
                id=sid(n),
                login=login,
                password=PASSWORDS.hash(password),
                role=role,
                customer=customer,
                branch=branch,
            )
        execute(
            s,
            "INSERT INTO accounts(id,number,kind,label) VALUES(:id,'SYSTEM-CLEARING','clearing','System clearing')",
            id=sid(20),
        )
        for n, cid in [(21, 3), (22, 4)]:
            execute(
                s,
                "INSERT INTO accounts(id,number,kind,customer_id,label,next_sequence) VALUES(:id,:number,'customer',:customer,'Tài khoản demo',1)",
                id=sid(n),
                number=f"10000000{n}",
                customer=sid(cid),
            )
            execute(
                s,
                "INSERT INTO transactions(id,type,destination_account_id,initiated_account_id,actor_id,branch_id,amount,status,received_at,account_sequence,latitude,longitude,location_source) VALUES(:id,'deposit',:account,:account,:actor,:branch,3000000000,'pending_review',:received,1,21.0285,105.8542,'branch')",
                id=sid(n + 100),
                account=sid(n),
                actor=sid(11),
                branch=sid(1),
                received=now() - timedelta(days=1),
            )
            execute(s, "SELECT post_command(:id)", id=sid(n + 100))
            execute(
                s,
                "INSERT INTO audit_logs(id,actor_id,action,resource_type,resource_id,request_id) VALUES(:id,:actor,'demo_seed_opening_funds','transaction',:tx,:request)",
                id=sid(n + 200),
                actor=sid(11),
                tx=sid(n + 100),
                request=sid(n + 300),
            )
        execute(
            s,
            "INSERT INTO rule_versions(id,version,high_amount_vnd,distance_km,rapid_amount_vnd,rapid_seconds,created_by) VALUES(:id,1,1000000000,500,500000000,30,:actor)",
            id=sid(30),
            actor=sid(10),
        )
        execute(s, "INSERT INTO rule_configuration VALUES(1,:id,1)", id=sid(30))
    db.engine.dispose()


def reconcile(url: str | None = None) -> list:
    load_local_env()
    db = Database(url or os.environ["DATABASE_URL"])
    with db.transaction() as s:
        result = s.execute(
            __import__("sqlalchemy").text(
                "SELECT a.id FROM accounts a WHERE a.posted_balance::numeric<>COALESCE((SELECT SUM(e.delta::numeric) FROM ledger_entries e WHERE e.account_id=a.id),0) OR a.reserved_amount::numeric<>COALESCE((SELECT SUM(r.amount::numeric) FROM reservations r WHERE r.account_id=a.id AND r.state='active'),0)"
            )
        ).all()
    db.engine.dispose()
    return [str(r[0]) for r in result]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["migrate", "seed", "reconcile"])
    args = parser.parse_args()
    if args.action == "migrate":
        migrate()
    elif args.action == "seed":
        seed()
    else:
        mismatch = reconcile()
        if mismatch:
            raise SystemExit(f"Reconciliation failed: {len(mismatch)} accounts")
        print("Reconciliation PASS")


if __name__ == "__main__":
    main()
