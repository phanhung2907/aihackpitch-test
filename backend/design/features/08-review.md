# F08 — Kiểm duyệt HOLD

## Trách nhiệm và giao diện

Module: **ReviewService + LedgerService**. Endpoint dưới đây thêm prefix `/api/v1`; payload chuẩn trong [OpenAPI](../../../contracts/openapi.yaml). [Quy ước chung](../technical-design.md) áp dụng cho tất cả.

`GET /fraud-alerts; GET /fraud-alerts/{alert_id}; POST /transactions/{transaction_id}/review-decisions`

## Người dùng và quyền

Chỉ fraud_analyst; actor != initiator, reason 10..1000 chars; session/CSRF/idempotency.

## Luồng xử lý

Đọc account IDs → lock sorted accounts → lock command → recheck pending. Reject lưu reason, status rejected/alert rejected và release reserve, không journal. Approve dùng snapshot override, recheck active/customer/reserve/overflow và post journal; consume reserve; không chạy rule lại thành vòng hold.

## Kết quả và trường hợp lỗi

200 Transaction; 409 ALREADY_DECIDED/ACCOUNT_NOT_ACTIVE/RESERVATION_MISMATCH. Retry cùng review key replay; key mới sau quyết định ->409. Reason rỗng/short ->422.

## Dữ liệu và transaction

Một UoW review_action/alert/command/ledger/reserve/audit/idempotency. Failure rollback giữ pending/reserve. Không có approve hàng loạt trong MVP.

## Tiêu chí nghiệm thu

REV-01 approve/reject; REV-02 analyst race; REV-03 actor self-review; REV-04 frozen approve vẫn hold; REV-05 reject frozen release; REV-06 audit/journal failure rollback.

Backend đã được triển khai; xem [implementation report](../../implementation-report.md) và tests trong backend/tests để biết bằng chứng runtime. Test IDs ở trên là traceability, không tự đại diện một pytest test cho từng ID.
