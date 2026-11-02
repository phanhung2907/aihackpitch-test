# F12 — Khởi động, seed và vận hành

## Trách nhiệm và giao diện

Module: **Config + migration runner + health + operator scripts**. Endpoint dưới đây thêm prefix `/api/v1`; payload chuẩn trong [OpenAPI](../../../contracts/openapi.yaml). [Quy ước chung](../technical-design.md) áp dụng cho tất cả.

`GET /health/live; GET /health/ready (không auth, response tối thiểu)`

## Người dùng và quyền

Operator chạy CLI local được cấp quyền, không có public HTTP seed/backup endpoint.

## Luồng xử lý

Validate env khi startup, từ chối secret thiếu hoặc demo mode trong release. Một runner Alembic, rồi API start. Live kiểm tra process, ready kiểm tra DB SELECT/schema version và money-write gate. Seed chỉ explicit demo profile. Backup pg_dump bằng role thích hợp, restore DB cô lập và reconcile trước khi dùng.

## Kết quả và trường hợp lỗi

200 live/ready nếu đạt; ready 503 DB/schema/reconciliation gate fail. Không leak DB URL/schema details qua public health.

## Dữ liệu và transaction

Compose volume không bị xóa bởi scripts reset ngầm. Không chạy docker compose down -v tự động. Log/metrics redacted. Rollback app giữ schema-compatible; không downgrade phá journal.

## Tiêu chí nghiệm thu

OPS-01 fresh migrate; OPS-02 restart giữ tiền; OPS-03 backup/restore reconcile; OPS-04 missing env fail; OPS-05 DB down ready503; OPS-06 CI không dùng secret thật.

Backend đã được triển khai; xem [implementation report](../../implementation-report.md) và tests trong backend/tests để biết bằng chứng runtime. Test IDs ở trên là traceability, không tự đại diện một pytest test cho từng ID.
