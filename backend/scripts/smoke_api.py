"""Black-box smoke test against the loopback-only Docker demo API."""

import os
from uuid import uuid4

import httpx

from banking.config import load_local_env
from banking.manage import sid


def main():
    load_local_env()
    base = "http://localhost:8000"

    def login(name):
        c = httpx.Client(base_url=base, headers={"Origin": base}, timeout=20)
        r = c.post(
            "/api/v1/auth/login", json={"login": name, "password": os.environ["DEMO_PASSWORD"]}
        )
        assert r.status_code == 200, (name, r.status_code)
        c.headers["X-CSRF-Token"] = r.json()["data"]["csrf_token"]
        return c

    with httpx.Client(base_url=base, timeout=20) as public:
        assert public.get("/api/v1/health/live").status_code == 200
        assert public.get("/api/v1/health/ready").status_code == 200
        assert public.get("/docs").status_code == 200
        assert len(public.get("/openapi.json").json()["paths"]) > 20
    teller = login("teller")
    analyst = login("analyst")
    try:
        r = teller.post(
            "/api/v1/deposits",
            headers={"Idempotency-Key": str(uuid4())},
            json={"account_id": sid(21), "amount": "1000000001"},
        )
        assert r.status_code == 201, r.status_code
        tx = r.json()["data"]
        assert tx["status"] == "pending_review" and "HIGH_AMOUNT" in tx["fraud_reason_codes"]
        r = analyst.post(
            "/api/v1/transactions/" + tx["id"] + "/review-decisions",
            headers={"Idempotency-Key": str(uuid4())},
            json={
                "decision": "reject",
                "reason": "Kiểm thử container: từ chối khoản gửi mô phỏng.",
            },
        )
        assert r.status_code == 200 and r.json()["data"]["status"] == "rejected"
        assert teller.get("/api/v1/transactions/" + tx["id"]).status_code == 200
        print(
            "HTTP Docker smoke PASS: live, ready, docs, OpenAPI, login, fraud HOLD, analyst reject, history"
        )
    finally:
        teller.close()
        analyst.close()


if __name__ == "__main__":
    main()
