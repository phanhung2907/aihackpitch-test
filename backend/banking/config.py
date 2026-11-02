import os
from dataclasses import dataclass
from pathlib import Path


def load_local_env() -> None:
    """Read local configuration without overriding operator/CI environment values."""
    path = Path(__file__).resolve().parents[2] / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key, value)


@dataclass(frozen=True)
class Settings:
    database_url: str
    secret: str
    origins: frozenset[str]
    secure_cookie: bool

    @classmethod
    def from_env(cls) -> "Settings":
        load_local_env()
        secret = os.environ.get("APP_SECRET", "")
        if len(secret) < 32 or secret.startswith("replace-"):
            raise RuntimeError("APP_SECRET must be explicitly configured (at least 32 characters)")
        url = os.environ.get("DATABASE_URL", "")
        if not url.startswith("postgresql+psycopg://"):
            raise RuntimeError("A PostgreSQL psycopg DATABASE_URL is required")
        origins = frozenset(os.environ.get("ALLOWED_ORIGINS", "").split(",")) - {""}
        if not origins or "*" in origins:
            raise RuntimeError("Configure exact ALLOWED_ORIGINS")
        return cls(url, secret, origins, os.environ.get("APP_ENV") != "development")
