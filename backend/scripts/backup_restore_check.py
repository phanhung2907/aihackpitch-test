"""Back up the local demo and verify restoration into a NEW isolated database."""

import argparse
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default="banking-demo")
    args = parser.parse_args()
    prefix = ["docker", "compose", "-p", args.project, "exec", "-T", "postgres"]
    folder = ROOT / "backend" / "backups"
    folder.mkdir(exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    backup = folder / f"banking_dev_{stamp}.dump"
    with backup.open("xb") as output:
        subprocess.run(
            [*prefix, "pg_dump", "-U", "bank_owner", "-d", "banking_dev", "-Fc"],
            cwd=ROOT,
            stdout=output,
            check=True,
        )
    target = "banking_restore_" + stamp + "_" + uuid4().hex[:8]
    subprocess.run([*prefix, "createdb", "-U", "bank_owner", target], cwd=ROOT, check=True)
    with backup.open("rb") as source:
        subprocess.run(
            [
                *prefix,
                "pg_restore",
                "-U",
                "bank_owner",
                "-d",
                target,
                "--no-owner",
                "--exit-on-error",
            ],
            cwd=ROOT,
            stdin=source,
            check=True,
        )
    sql = "SELECT count(*) FROM accounts a WHERE posted_balance::numeric<>coalesce((SELECT sum(delta::numeric) FROM ledger_entries WHERE account_id=a.id),0) OR reserved_amount::numeric<>coalesce((SELECT sum(amount::numeric) FROM reservations WHERE account_id=a.id AND state='active'),0)"
    result = subprocess.run(
        [*prefix, "psql", "-U", "bank_owner", "-d", target, "-At", "-c", sql],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    if result.stdout.strip() != "0":
        raise SystemExit("Restored ledger reconciliation failed")
    print(
        f"Backup/restore PASS: {backup.name}; isolated database {target}; no original database overwritten"
    )


if __name__ == "__main__":
    main()
