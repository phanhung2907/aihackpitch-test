# F09 — Đảo giao dịch đã ghi sổ

## Trách nhiệm và giao diện

Module: **ReversalService + LedgerService**. Endpoint dưới đây thêm prefix `/api/v1`; payload chuẩn trong [OpenAPI](../../../contracts/openapi.yaml). [Quy ước chung](../technical-design.md) áp dụng cho tất cả.

`POST /transactions/{transaction_id}/reversal-requests; GET /reversal-requests; POST /reversal-requests/{reversal_id}/review-decisions`

## Người dùng và quyền

Teller yêu cầu; fraud_analyst duyệt khác requester. Không cho customer/admin sửa history.

## Luồng xử lý

Chỉ original posted và chưa có active/posted reversal. Đảo toàn bộ, không partial. Request luôn pending_review, không reserve ở lúc yêu cầu để tránh giữ tiền ngầm của người nhận. Approve lock accounts/command/request, tất cả active và mọi customer bị debit có available>=A; tạo journal đối dấu, mark original reversed và reversal posted. Reject giữ original posted.

## Kết quả và trường hợp lỗi

Create 201 ReversalRequest; quyết định 200; duplicate active/reversed 409. Insufficient khi approve ->409, giữ request pending; analyst có thể reject. Request đã rejected có thể được teller tạo lại với key mới.

## Dữ liệu và transaction

unique partial original where pending/posted; original_journal_id unique trên journal đảo. Lệnh reversal không vào fraud candidate history, nhưng entry đảo có trong lịch sử balances và audit.

## Tiêu chí nghiệm thu

RVS-01 đảo từng loại; RVS-02 chỉ một reversal posted; RVS-03 thiếu tiền không âm; RVS-04 race với spend; RVS-05 không sửa journal gốc; RVS-06 self-review chặn.

Backend đã được triển khai; xem [implementation report](../../implementation-report.md) và tests trong backend/tests để biết bằng chứng runtime. Test IDs ở trên là traceability, không tự đại diện một pytest test cho từng ID.
