# F10 — Lịch sử, dashboard và audit

## Trách nhiệm và giao diện

Module: **QueryService**. Endpoint dưới đây thêm prefix `/api/v1`; payload chuẩn trong [OpenAPI](../../../contracts/openapi.yaml). [Quy ước chung](../technical-design.md) áp dụng cho tất cả.

`GET /transactions; GET /transactions/{transaction_id}; GET /dashboard; GET /audit-logs`

## Người dùng và quyền

Customer history account mình, không evidence nhạy cảm. Teller giao dịch nghiệp vụ; analyst alert/reversal liên quan; admin chỉ audit/config, không đọc balance mặc định.

## Luồng xử lý

History filter time/type/status/account, cursor ổn định theo created_at,id. Dashboard theo role: customer balances/own activity; teller activity counts; analyst open alerts/pending age; admin user/config activity. GET transaction chỉ trường được role phép; fraud_summary gồm reason codes cho owner, evidence chi tiết chỉ alert endpoints analyst.

## Kết quả và trường hợp lỗi

200 với data/meta; not-owned 404, forbidden audit 403, query invalid 422. Một response dashboard dùng READ ONLY REPEATABLE READ cho snapshot, không SELECT độc lập làm số tổng trái nhau.

## Dữ liệu và transaction

Read replicas/cache chưa có; filters áp trước pagination và aggregates. Lệnh reversed giữ journal gốc, response liên kết reversal; ledger mới thể hiện effect ròng. Audit admin đọc, append-only, redacted.

## Tiêu chí nghiệm thu

HIS-01 filters/cursor; HIS-02 IDOR cả list/detail/aggregate; HIS-03 pending không counted posted; HIS-04 đảo không double count; HIS-05 PII/evidence redaction.

Chưa có code chạy ở checkpoint thiết kế. Test IDs là yêu cầu triển khai, không phải test đã pass.
