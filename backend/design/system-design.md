# Kiến trúc hệ thống backend

## 1. Phạm vi và các ranh giới

Một **modular monolith FastAPI** và một PostgreSQL. Frontend React SPA gọi API cùng origin `/api/v1`. Không đưa queue/broker/cache phân tán vào đường tiền của MVP. Ngân hàng, tiền và tọa độ là dữ liệu mô phỏng; không có kết nối tài chính bên ngoài.

| Thành phần | Trách nhiệm | Không được làm |
| --- | --- | --- |
| Frontend | Form, màn hình theo vai trò, hiển thị trạng thái và evidence | Tự tính số dư có thẩm quyền, tự quyết định fraud/quyền |
| Nginx | Phục vụ SPA, proxy `/api`, request size/timeout | Truy cập bảng tài chính |
| API FastAPI | Validation, session/CSRF, permission, DTO, request ID | Commit rải rác trong router |
| IdentityService | Phiên, vai trò, login throttle | Nhận role do browser tự gán |
| CustomerService / AccountService | CRUD và vòng đời, ownership | Sửa trực tiếp ledger balance |
| TransactionService | Điều phối gửi/rút/chuyển và retry | Gọi HTTP ngoài khi giữ khóa DB |
| FraudService | Đánh giá luật với history dưới khóa; snapshot evidence | Tự commit hoặc sửa số dư |
| ReviewService / ReversalService | Quyết định có lý do, four-eyes, state transitions | Duyệt lại giao dịch đã hoàn tất |
| LedgerService | Tạo journal cân bằng, reserve/consume/release, overflow check | Chạy transaction riêng với transaction cha |
| AdminService | Users/branches và rule versions | Quyền ghi tiền mặc định cho admin |
| QueryService | Read models: history, dashboard, alerts theo quyền | Trả secret/session hash/PII không cần thiết |
| UnitOfWork / repositories | Một SQLAlchemy session cho một use case, transaction/locks | Chia sẻ session giữa requests/threads |
| PostgreSQL | FK/UNIQUE/CHECK, durable commit, row locks | Cho người dùng browser kết nối trực tiếp |

Import một chiều: API → application services → domain policies và repository interfaces → SQLAlchemy adapters. Domain fraud/amount không phụ thuộc FastAPI. Mọi mutation tài chính đi qua TransactionService hoặc Review/ReversalService, dùng cùng LedgerService và cùng UnitOfWork.

## 2. Topology và giao tiếp

Browser → Nginx:8080 → FastAPI:8000 → Postgres:5432 trong mạng Docker riêng. Chỉ publish Nginx trong full stack; profile dev có thể bind database vào 127.0.0.1 có chủ đích. Vite dev proxy `/api` khi frontend chạy ngoài compose. Không bật CORS wildcard + cookie. Request JSON, response JSON, cookie session opaque; mutations có CSRF và Origin allowlist.

Phân tách quyền DB: migration owner, runtime role không superuser/DDL; runtime không UPDATE/DELETE journal/entries/audit. Constraints và deferred triggers bảo vệ journal cân bằng lúc commit. Dịch vụ khác không viết trực tiếp bảng tiền.

## 3. Runtime/version matrix

| Tầng | Baseline đã chốt | Khóa khi bootstrap |
| --- | --- | --- |
| Python | 3.13 | Patch + base image digest |
| HTTP/schema | FastAPI stable, Pydantic 2 | uv.lock |
| ORM/driver | SQLAlchemy 2.0 family synchronous, psycopg 3 | uv.lock |
| Migrations | Alembic | uv.lock |
| DB | PostgreSQL 17 | image minor + digest |
| Frontend | React stable + TypeScript strict + Vite; Node 24 LTS | package-lock.json |
| QA | pytest/cov, HTTPX, Ruff, mypy | uv.lock |

Đây là baseline, không phải version matrix đã cài/test. Nếu patch tương thích không còn được hỗ trợ thì báo trước khi đổi family. Không tự dùng canary, `latest` image hoặc migrate tự động từ mỗi API replica.

## 4. Thông tin, quan sát và recovery

Request ID do server cấp; log có route, duration, status, transaction ID và actor ID cần thiết; không log password, cookie, CSRF, request body tiền hoặc vị trí chi tiết. Evidence có quyền analyst, audit chỉ đọc theo role. Không đưa số dư vào error logs.

Metrics dự kiến: HTTP error/latency, DB pool wait/lock timeout, counts posted/held/rejected, rule match theo rule ID, pending age, reconciliation mismatch. Không dùng customer ID làm label metrics. Rule/admin thay đổi có audit.

DB commit là ranh giới sự thật. Browser timeout sau commit không phải giao dịch thất bại: cùng idempotency key lấy lại resource. Không có email/webhook side effect trong transaction MVP. Nếu bổ sung thông báo sau này phải có outbox.

Đích nghiệm thu: compose local có persistent volume, health/readiness và backup/restore sang database cô lập. Không khẳng định production-ready hoặc có HA chỉ vì có Docker.

## 5. Tài liệu nền tảng

Thiết kế chọn row locks theo [PostgreSQL locking](https://www.postgresql.org/docs/17/explicit-locking.html). Mỗi use case có session riêng, quản lý commit/rollback theo [SQLAlchemy Session Basics](https://docs.sqlalchemy.org/en/20/orm/session_basics.html). Handler synchronous được chọn cho synchronous I/O theo [FastAPI concurrency](https://fastapi.tiangolo.com/async/). Chính sách cookie/rotation dựa trên [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), bổ sung kiểm thử riêng cho ứng dụng.
