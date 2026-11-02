# F05 — Rút tiền

## Trách nhiệm và giao diện

Module: **TransactionService + FraudService + LedgerService**. Endpoint dưới đây thêm prefix `/api/v1`; payload chuẩn trong [OpenAPI](../../../contracts/openapi.yaml). [Quy ước chung](../technical-design.md) áp dụng cho tất cả.

`POST /withdrawals`

## Người dùng và quyền

Chỉ teller tại chi nhánh active; khách hàng không tự tạo lệnh cash withdrawal qua API.

## Luồng xử lý

Lock account/clearing theo UUID, active + available>=A. ALLOW journal customer −A/clearing +A. HOLD tạo reserve A nhưng posted_balance giữ nguyên. Không ghi candidate/history accepted cho lệnh không đủ tiền.

## Kết quả và trường hợp lỗi

201 posted/pending_review; 409 INSUFFICIENT_FUNDS hoặc ACCOUNT_NOT_ACTIVE. Response chứa balances đọc từ DB; không hứa giữ nguyên nếu giao dịch khác diễn ra sau response.

## Dữ liệu và transaction

Reserve và lệnh commit nguyên tử. available=posted-reserved, mọi concurrent request kiểm tra lại dưới lock.

## Tiêu chí nghiệm thu

WDR-01 amount biên; WDR-02 hai rút vượt available; WDR-03 hold/reserve; WDR-04 approve consume/reject release; WDR-05 retry không double-reserve.

Chưa có code chạy ở checkpoint thiết kế. Test IDs là yêu cầu triển khai, không phải test đã pass.
