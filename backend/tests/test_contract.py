import json
from pathlib import Path

from openapi_spec_validator import validate_spec

from banking.contract import SPEC, validate


def test_canonical_openapi_and_all_examples():
    validate_spec(SPEC)
    examples = json.loads(
        (Path(__file__).resolve().parents[2] / "contracts/examples.json").read_text(
            encoding="utf-8"
        )
    )
    for e in examples:
        validate({"$ref": "#/components/schemas/" + e["schema"]}, e["value"])


def test_mutations_have_csrf_and_money_has_idempotency():
    money = {
        "createDeposit",
        "createWithdrawal",
        "createTransfer",
        "reviewTransaction",
        "requestReversal",
        "reviewReversal",
    }
    for methods in SPEC["paths"].values():
        for method, op in methods.items():
            headers = {
                p["name"]
                for p in op.get("parameters", [])
                if p["in"] == "header" and p.get("required")
            }
            if method != "get" and op["operationId"] != "login":
                assert "X-CSRF-Token" in headers
            if op["operationId"] in money:
                assert "Idempotency-Key" in headers


def test_served_openapi_is_canonical_without_database():
    from banking.api import create_app
    from banking.config import Settings

    app = create_app(
        Settings(
            "postgresql+psycopg://nobody:nothing@127.0.0.1:65435/missing",
            "test-only-secret-at-least-32-characters",
            frozenset({"http://testserver"}),
            False,
        )
    )
    try:
        assert app.openapi()["servers"] == SPEC["servers"]
        assert app.openapi()["components"] == SPEC["components"]
    finally:
        app.state.db.engine.dispose()
