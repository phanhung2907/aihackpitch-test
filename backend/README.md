# Backend

Backend Python/FastAPI sẽ được triển khai trong thư mục này, dùng PostgreSQL chạy Docker. Triển khai và kiểm thử theo hợp đồng API chung sau khi duyệt kế hoạch/thiết kế.

Xem [kế hoạch chi tiết](../plans/banking-webapp-plan.md). Chưa tạo ứng dụng, schema hoặc migrations ở bước kế hoạch.

Stack đã chốt: Python 3.13, FastAPI, Pydantic 2, SQLAlchemy 2 synchronous, psycopg 3, Alembic, PostgreSQL 17 Docker; uv/uv.lock; pytest, Ruff và mypy. Modular monolith, rule engine đồng bộ, session cookie phía server.
