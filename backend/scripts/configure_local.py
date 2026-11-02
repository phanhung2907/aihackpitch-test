"""Create ignored demo-only configuration with random credentials; preserve existing config."""

import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[2]
path = root / ".env"
if path.exists():
    raise SystemExit(
        "Existing .env preserved; edit it explicitly if configuration changes are needed"
    )
owner = secrets.token_hex(24)
runtime = secrets.token_hex(24)
values = {
    "POSTGRES_PASSWORD": owner,
    "BANK_APP_PASSWORD": runtime,
    "APP_SECRET": secrets.token_hex(32),
    "DEMO_PASSWORD": secrets.token_urlsafe(18),
    "APP_ENV": "development",
    "ALLOWED_ORIGINS": "http://localhost:8080,http://localhost:5173,http://localhost:8000,http://testserver",
    "DATABASE_URL": f"postgresql+psycopg://bank_app:{runtime}@127.0.0.1:55432/banking_dev",
    "MIGRATION_DATABASE_URL": f"postgresql+psycopg://bank_owner:{owner}@127.0.0.1:55432/banking_dev",
    "TEST_DATABASE_URL": f"postgresql+psycopg://bank_app:{runtime}@127.0.0.1:55433/banking_test",
    "TEST_MIGRATION_DATABASE_URL": f"postgresql+psycopg://bank_owner:{owner}@127.0.0.1:55433/banking_test",
}
with path.open("x", encoding="utf-8") as f:
    f.write("".join(f"{k}={v}\n" for k, v in values.items()))
print("Created ignored .env with random demo credentials; no values displayed")
