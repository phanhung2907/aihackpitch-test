# F04 — Gửi tiền

## Trách nhiệm và giao diện

Module: **TransactionService + FraudService + LedgerService**. Endpoint dưới đây thêm prefix `/api/v1`; payload chuẩn trong [OpenAPI](../../../contracts/openapi.yaml). [Quy ước chung](../technical-design.md) áp dụng cho tất cả.

`POST /deposits`

## Người dùng và quyền

Chỉ teller enabled gắn chi nhánh active. Đây là tiền mặt mô phỏng, không gọi ngân hàng ngoài.

## Luồng xử lý

Nhận account_id/amount; branch/location từ server. Session+CSRF+idempotency rồi lock customer/account/clearing, check active/overflow, gán sequence, đánh giá mọi luật. ALLOW journal clearing −A/customer +A; HOLD pending + alert, không credit/reserve.

## Kết quả và trường hợp lỗi

201 Transaction envelope cho cả posted và pending_review; response luôn hiển thị status. 409 frozen/overflow; 422 amount; 503 rule/DB rollback. Retry cùng key replay HTTP 201 và resource hiện tại.

## Dữ liệu và transaction

Một UoW cho command/evaluation/journal-or-alert/audit/idempotency. Customer funds chỉ có sau posted.

## Tiêu chí nghiệm thu

DEP-01 allow balanced journal; DEP-02 >1 tỷ hold không credit; DEP-03 branch location; DEP-04 idempotent; DEP-05 exception giữa các insert rollback.

Backend đã được triển khai; xem [implementation report](../../implementation-report.md) và tests trong backend/tests để biết bằng chứng runtime. Test IDs ở trên là traceability, không tự đại diện một pytest test cho từng ID.
