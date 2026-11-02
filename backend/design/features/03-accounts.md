# F03 — CRUD và vòng đời tài khoản

## Trách nhiệm và giao diện

Module: **AccountService**. Endpoint dưới đây thêm prefix `/api/v1`; payload chuẩn trong [OpenAPI](../../../contracts/openapi.yaml). [Quy ước chung](../technical-design.md) áp dụng cho tất cả.

`GET/POST /accounts; GET/PATCH /accounts/{account_id}; POST /accounts/{account_id}/state-changes`

## Người dùng và quyền

Teller mở/đổi label/freeze/unfreeze/close; customer chỉ đọc của mình. Không có DELETE ledger account.

## Luồng xử lý

Tạo số tài khoản unique do server cấp, balance=0, VND, customer active. PATCH label + expected_version. State change có target_state/reason/expected_version. Close khi posted=0/reserved=0, không pending transaction/reversal liên quan cả hai phía. Closed terminal. Frozen chặn mọi post nhưng cho phép analyst reject hold.

## Kết quả và trường hợp lỗi

Create 201; update/read/state change 200. Trạng thái/tiền/pending/version sai ->409. Balance/owner/kind do client truyền ->422. Không có endpoint sửa balance.

## Dữ liệu và transaction

customers SHARE rồi accounts UPDATE; freeze/close và post dùng cùng row locks; account creation check customer active dưới khóa.

## Tiêu chí nghiệm thu

ACC-01 open/read/label; ACC-02 freeze race với post; ACC-03 close balance/reserve/pending; ACC-04 closed không reopen; ACC-05 ownership.

Chưa có code chạy ở checkpoint thiết kế. Test IDs là yêu cầu triển khai, không phải test đã pass.
