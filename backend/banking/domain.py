import math
import re
from datetime import UTC, datetime
from typing import Any

MAX_MONEY = 9223372036854775807


def parse_amount(value: Any) -> int:
    if not isinstance(value, str) or not re.fullmatch(r"[1-9][0-9]{0,18}", value):
        raise ValueError("Amount must be a positive digit-string VND value")
    amount = int(value)
    if amount > MAX_MONEY:
        raise ValueError("Amount exceeds BIGINT")
    return amount


def distance_km(first: tuple[float, float], second: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (*first, *second))
    value = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 6371.0088 * 2 * math.asin(math.sqrt(min(1.0, max(0.0, value))))


def now() -> datetime:
    return datetime.now(UTC)


def location(command: dict) -> tuple[float, float] | None:
    if command.get("latitude") is None or command.get("longitude") is None:
        return None
    return command["latitude"], command["longitude"]


def assess_fraud(current: dict, history: list[dict], rules: dict) -> dict:
    previous = max(history, key=lambda c: c["account_sequence"], default=None)
    current_location = location(current)
    unavailable = current_location is None or (previous is not None and location(previous) is None)
    distance = None
    if previous and not unavailable:
        distance = distance_km(current_location, location(previous))  # type: ignore[arg-type]
    rapid = next(
        (
            c
            for c in history
            if c["amount"] > rules["rapid_amount_vnd"]
            and abs((current["received_at"] - c["received_at"]).total_seconds())
            <= rules["rapid_seconds"]
        ),
        None,
    )
    checks = [
        (
            "HIGH_AMOUNT",
            current["amount"] > rules["high_amount_vnd"],
            str(rules["high_amount_vnd"]),
            str(current["amount"]),
            None,
            "clear",
        ),
        (
            "DISTANT_LOCATIONS",
            distance is not None and distance > rules["distance_km"],
            str(rules["distance_km"]),
            str(distance) if distance is not None else None,
            previous,
            "unavailable" if unavailable else "skipped" if previous is None else "clear",
        ),
        (
            "RAPID_LARGE_TRANSACTIONS",
            current["amount"] > rules["rapid_amount_vnd"] and rapid is not None,
            f"{rules['rapid_amount_vnd']} VND / {rules['rapid_seconds']}s",
            str(abs((current["received_at"] - rapid["received_at"]).total_seconds()))
            if rapid
            else None,
            rapid,
            "clear",
        ),
        ("LOCATION_UNAVAILABLE", unavailable, "paired valid location", None, previous, "clear"),
    ]
    results = []
    for rule_id, matched, threshold, observed, candidate, clear_result in checks:
        coord = location(candidate) if candidate else None
        results.append(
            {
                "rule_id": rule_id,
                "result": "matched" if matched else clear_result,
                "threshold": threshold,
                "observed": observed,
                "candidate_transaction_id": str(candidate["id"]) if candidate else None,
                "candidate_received_at": candidate["received_at"].isoformat()
                if candidate
                else None,
                "candidate_sequence": candidate["account_sequence"] if candidate else None,
                "current_sequence": current["account_sequence"],
                "location_source": current["location_source"],
                "current_received_at": current["received_at"].isoformat(),
                "current_amount": str(current["amount"]),
                "candidate_amount": str(candidate["amount"]) if candidate else None,
                "current_location": {
                    "latitude": current_location[0],
                    "longitude": current_location[1],
                }
                if current_location
                else None,
                "candidate_location": {"latitude": coord[0], "longitude": coord[1]}
                if coord
                else None,
            }
        )
    reasons = [r["rule_id"] for r in results if r["result"] == "matched"]
    return {"outcome": "hold" if reasons else "allow", "reasons": reasons, "results": results}
