# Backend — Banking webapp

Thiết kế backend đã được tạo; chưa triển khai server, migrations hoặc runtime dependencies.

- [Chỉ mục thiết kế tổng thể và 12 chức năng](design/README.md)
- [Sơ đồ sản phẩm A đến Z và chú giải](design/product-flow.md)
- [Kiến trúc hệ thống](design/system-design.md)
- [Thiết kế kỹ thuật](design/technical-design.md)
- [Mô hình dữ liệu](design/data-model.md)
- [Hợp đồng OpenAPI dùng chung](../contracts/openapi.yaml)
- [Kế hoạch và checkpoints](../plans/banking-webapp-plan.md)

Stack: Python 3.13, FastAPI/Pydantic 2, SQLAlchemy 2 synchronous, psycopg 3, Alembic, PostgreSQL 17 Docker; uv, pytest, Ruff, mypy. Modular monolith, session cookie phía server. Chỉ bắt đầu implementation sau khi chủ repo duyệt thiết kế.
