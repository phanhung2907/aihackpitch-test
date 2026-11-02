# F06 — Chuyển nội bộ

## Trách nhiệm và giao diện

Module: **TransactionService + FraudService + LedgerService**. Endpoint dưới đây thêm prefix `/api/v1`; payload chuẩn trong [OpenAPI](../../../contracts/openapi.yaml). [Quy ước chung](../technical-design.md) áp dụng cho tất cả.

`POST /transfers`

## Người dùng và quyền

Customer chỉ từ account của mình; không dùng teller/admin thay quyền chủ tài khoản trong MVP.

## Luồng xử lý

Nhận source_account_id/destination_account_id/amount/location. Recipient lookup bằng account number endpoint trả tên rút gọn, không balance/PII. Source != destination; cả hai active VND; lock accounts sorted UUID. Fraud chỉ tài khoản nguồn, inbound không tạo candidate vị trí của recipient. ALLOW source −A/destination +A; HOLD reserve nguồn, đích chưa được credit.

## Kết quả và trường hợp lỗi

201 posted hoặc pending_review; 409 insufficient/frozen/self-transfer state; shape sai 422. Nếu approve sau đó đích frozen, 409 và giữ pending/reserve, analyst có thể reject.

## Dữ liệu và transaction

Customer rows sorted trước accounts sorted; update hai balance/journal trong một UoW; overflow destination cũng rollback source.

## Tiêu chí nghiệm thu

TRF-01 atomicity; TRF-02 A→B và B→A đồng thời; TRF-03 IDOR; TRF-04 held recipient không tăng tiền; TRF-05 overflow; TRF-06 inbound không gây false distant.

Chưa có code chạy ở checkpoint thiết kế. Test IDs là yêu cầu triển khai, không phải test đã pass.
