from datetime import UTC, datetime, timedelta

import pytest

from banking.domain import MAX_MONEY, assess_fraud, distance_km, parse_amount


@pytest.mark.parametrize("value", ["0", "-1", "1.2", "1e9", " 1", 1, str(MAX_MONEY + 1)])
def test_invalid_money(value):
    with pytest.raises(ValueError):
        parse_amount(value)


def test_money_exact():
    assert parse_amount(str(MAX_MONEY)) == MAX_MONEY
    assert parse_amount("1000000001") == 1000000001


def command(amount, seconds=0, location=(21.0285, 105.8542), sequence=1):
    return {"id": "candidate", "amount": amount, "received_at": datetime(2026, 11, 3, tzinfo=UTC) + timedelta(seconds=seconds), "latitude": location[0] if location else None, "longitude": location[1] if location else None, "location_source": "demo_client", "account_sequence": sequence}


RULES = {"version": 1, "high_amount_vnd": 1000000000, "distance_km": 500, "rapid_amount_vnd": 500000000, "rapid_seconds": 30}


@pytest.mark.parametrize("amount,expected", [(1000000000, False), (1000000001, True)])
def test_high_amount(amount, expected):
    results = assess_fraud(command(amount), [], RULES)
    assert ("HIGH_AMOUNT" in results["reasons"]) is expected


@pytest.mark.parametrize("seconds,expected", [(29.999, True), (30, True), (30.001, False), (-20, True)])
def test_rapid_boundary_and_out_of_order(seconds, expected):
    result = assess_fraud(command(500000001, seconds), [command(500000001)], RULES)
    assert ("RAPID_LARGE_TRANSACTIONS" in result["reasons"]) is expected


def test_exact_500_million_is_clear():
    assert not assess_fraud(command(500000000, 1), [command(500000001)], RULES)["reasons"]


def test_distant_and_missing_location():
    assert distance_km((21.0285, 105.8542), (10.8231, 106.6297)) > 500
    assert distance_km((0, 0), (0, 0)) == 0
    assert "DISTANT_LOCATIONS" in assess_fraud(command(1, location=(10.8231, 106.6297)), [command(1)], RULES)["reasons"]
    assert "LOCATION_UNAVAILABLE" in assess_fraud(command(1, location=None), [], RULES)["reasons"]
    assert "LOCATION_UNAVAILABLE" in assess_fraud(command(1), [command(1, location=None)], RULES)["reasons"]


def test_first_command_and_multiple_rules():
    assert not assess_fraud(command(1), [], RULES)["reasons"]
    result = assess_fraud(command(1000000001, 1, (10.8231, 106.6297)), [command(600000000)], RULES)
    assert set(result["reasons"]) == {"HIGH_AMOUNT", "DISTANT_LOCATIONS", "RAPID_LARGE_TRANSACTIONS"}
