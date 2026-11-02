# Backend — Banking webapp

Backend FastAPI/PostgreSQL đã triển khai, có kiểm thử unit, từng chức năng, contract và hệ thống/concurrency. Frontend chưa được triển khai trong checkpoint backend này. Đây là ngân hàng mô phỏng dùng tiền/dữ liệu demo.

## Chạy bằng Docker

Từ thư mục repo:

```powershell
python backend/scripts/configure_local.py
docker compose -p banking-demo --profile app up -d --build --wait backend
docker compose -p banking-demo --profile app run --rm migrate python -m banking.manage seed
```

Lệnh cấu hình tạo `.env` với giá trị ngẫu nhiên và không ghi đè file đã có. Nếu repo đã có `.env` được thiết lập, bỏ qua lệnh đầu. Database demo dùng volume `banking-demo_banking-data`; không xóa volume khi restart. Seed idempotent, chỉ chạy khi `APP_ENV=development`; số dư đầu kỳ đi qua bút toán cân bằng.

- Swagger: [http://localhost:8000/docs](http://localhost:8000/docs)
- OpenAPI: [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)
- Live / ready: `/api/v1/health/live`, `/api/v1/health/ready`.
- Users giả lập: `admin`, `teller`, `analyst`, `alice`, `bob`. Mật khẩu chung của seed là giá trị `DEMO_PASSWORD` trong `.env` local; không lưu giá trị đó trong Git.

Đăng nhập bằng POST `/api/v1/auth/login`. Browser giữ cookie HttpOnly; lấy `csrf_token` từ response rồi gửi `X-CSRF-Token` trong các lệnh thay đổi dữ liệu. Thêm `Idempotency-Key` mới cho một lệnh tiền mới, giữ nguyên key khi retry cùng lệnh. Header Origin phải nằm trong `ALLOWED_ORIGINS` (ví dụ `http://localhost:8000`). Trong Swagger, dùng csrf token trả về để điền header; không cần nhập raw cookie token.

Backend container chạy user không phải root và chỉ nhận database URL runtime; credentials migration không được đưa vào runtime container. Postgres demo/test chỉ bind loopback 55432/55433. Không có kết nối ngân hàng thật hoặc CD production.

## Phát triển Python trên máy

Cần Python 3.13, uv 0.12.13 và Docker Desktop đang chạy. `.env` được đọc từ repo root, environment của operator/CI được ưu tiên.

```powershell
docker compose -p banking-demo --profile test up -d --wait postgres postgres-test
cd backend
uv sync --frozen
uv run python -m banking.manage migrate
uv run python -m banking.manage seed
uv run uvicorn banking.main:app --host 127.0.0.1 --port 8001
```

Nếu chạy ở port khác 8000, thêm origin tương ứng vào `.env` trước khi mở server. Container backend đã dùng port 8000; không chạy server local cùng port đó. API routes synchronous DB chạy trong thread pool; mỗi use case có một SQLAlchemy session/transaction riêng.

## Kiểm thử theo thứ tự

Trong `backend/`, database test riêng `banking_test` ở port 55433 phải hoạt động:

```powershell
uv run pytest tests/test_domain.py tests/test_contract.py -q
uv run pytest tests/test_features.py -q
uv run pytest tests/test_system.py -q
uv run pytest --cov=banking --cov-report=term-missing --cov-report=json --cov-fail-under=80
uv run python scripts/check_core_coverage.py
uv run ruff check banking tests migrations scripts
uv run ruff format --check banking tests migrations scripts
uv run mypy banking
```

Tests chỉ cleanup database có tên kết thúc `_test`, phải khác DB demo. Fixture reset dữ liệu trong DB đó, migrate và seed lại; không thay PostgreSQL bằng SQLite. Domain tests chạy clock cố định; integration tests dùng API thật/DB thật và barrier cho các lệnh đồng thời. Không chạy hai pytest suites song song trên cùng database test.

Kiểm tra HTTP black-box và backup/restore sau khi Docker backend đang chạy:

```powershell
uv run python -m scripts.smoke_api
uv run python -m scripts.backup_restore_check
uv run python -m banking.manage reconcile
```

Smoke test tạo một khoản gửi demo bị giữ rồi từ chối, giữ nguyên tiền nhưng thêm history/audit. Backup script lưu dump trong `backend/backups/` bị gitignore; restore vào database mới `banking_restore_*`, không ghi đè DB gốc. Database restore được giữ lại để kiểm tra. Chỉ dùng các scripts này với stack demo local.

## Cấu trúc và nghiệp vụ

- `banking/api.py`: đăng ký 41 operations từ hợp đồng, auth/CSRF, validation và transaction boundary.
- `banking/resources.py`: customers/accounts/users/branches/rule versions, history và dashboard theo quyền.
- `banking/money.py`: điều phối gửi/rút/chuyển, idempotency, review và reversal.
- `banking/domain.py`: parse tiền và luật fraud pure functions.
- `banking/manage.py`, `migrations/`: migration owner, runtime grants, seed và đối soát.
- `tests/`: kiểm thử tiền, quyền, fraud, trạng thái, lỗi, race conditions và contract.

Tiền API là digit string VND. Giao dịch nghi ngờ giữ chỗ debit, chưa chuyển tiền; analyst approve/reject có lý do. Ledger bất biến và cân bằng, protected bằng grants/functions/triggers trong PostgreSQL. Reversal tạo journal mới, không sửa/xóa entries cũ. Lỗi trước commit rollback mọi thay đổi; retry sau timeout dùng cùng key.

Hợp đồng [OpenAPI](../contracts/openapi.yaml) là nguồn schema chuẩn. Runtime dùng JSON Schema validator cho cả request và response để frontend sinh types/mock theo cùng artifact; không duy trì một bộ DTO viết tay thứ hai. FastAPI phục vụ spec canonical, inventory tests đối chiếu routes thực và contract, response validation xảy ra trước commit. Hai PATCH admin còn thiếu trong bản design ban đầu đã bổ sung: users và branches; operation listBranches đã chuẩn hóa tên. Server URL tương đối cho cùng origin.

## CI và giới hạn kiểm chứng

[GitHub Actions](../.github/workflows/backend.yml) chạy lint/format/type, toàn bộ pytest với PostgreSQL, coverage gates, audit runtime dependencies và Docker build. Không tự triển khai production. Trạng thái CI remote phải xem run thực tế, không suy ra từ kết quả local.

Baseline local Python 3.13.14; container Python 3.13.18. Dependencies khóa trong `uv.lock`; ảnh Python/uv/Postgres được ghim digest. Báo cáo kết quả: [implementation report](implementation-report.md).

Thiết kế được giữ tại [design index](design/README.md); bước tiếp theo sau review là frontend dùng MSW/generated types và tích hợp giao diện.
