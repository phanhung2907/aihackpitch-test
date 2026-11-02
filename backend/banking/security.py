import base64
import hashlib
import hmac
import json
from datetime import datetime
from uuid import UUID

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError

PASSWORDS = PasswordHasher()
DUMMY_HASH = PASSWORDS.hash("invalid-user-dummy-password")


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str | None = None, details=None):
        super().__init__(code)
        self.status = status
        self.code = code
        self.message = message or code.replace("_", " ").capitalize()
        self.details = details or []


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def verify_password(hashed: str, password: str) -> bool:
    try:
        return PASSWORDS.verify(hashed, password)
    except VerificationError:
        return False


def csrf_token(secret: str, session_id: str) -> str:
    return hmac.new(secret.encode(), ("csrf:" + session_id).encode(), hashlib.sha256).hexdigest()


def encode_cursor(secret: str, value: dict) -> str:
    body = base64.urlsafe_b64encode(json.dumps(value, sort_keys=True).encode()).decode()
    sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    return body + "." + sig


def decode_cursor(secret: str, value: str, scope: str) -> dict:
    try:
        body, sig = value.split(".")
        expected = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig):
            raise ValueError("signature")
        payload = json.loads(base64.urlsafe_b64decode(body))
        if payload["scope"] != scope:
            raise ValueError("scope")
        datetime.fromisoformat(payload["created_at"])
        UUID(payload["id"])
        return payload
    except (ValueError, KeyError, TypeError) as exc:
        raise ApiError(422, "INVALID_CURSOR") from exc
