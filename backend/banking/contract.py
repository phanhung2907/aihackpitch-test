import json
from pathlib import Path
from uuid import uuid4

import yaml
from fastapi.encoders import jsonable_encoder
from jsonschema import Draft202012Validator, FormatChecker

from banking.security import ApiError

SPEC_PATH = Path(__file__).resolve().parents[2] / "contracts" / "openapi.yaml"
SPEC = yaml.safe_load(SPEC_PATH.read_text(encoding="utf-8-sig"))


def validate(schema: dict, value, *, response: bool = False):
    validator = Draft202012Validator(
        {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "components": SPEC["components"],
            **schema,
        },
        format_checker=FormatChecker(),
    )
    errors = sorted(validator.iter_errors(value), key=lambda e: str(e.path))
    if errors:
        details = [
            {
                "field": ".".join(map(str, e.path)),
                "code": "invalid_value",
                "message": "Value does not match the API contract",
            }
            for e in errors
        ]
        raise ApiError(
            500 if response else 422,
            "RESPONSE_CONTRACT_ERROR" if response else "VALIDATION_ERROR",
            details=details,
        )


def clean(value):
    return jsonable_encoder(value)


def to_json(value) -> str:
    return json.dumps(clean(value), sort_keys=True, separators=(",", ":"), allow_nan=False)


def new_id() -> str:
    return str(uuid4())
