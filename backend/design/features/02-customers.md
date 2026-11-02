# F02 — CRUD khách hàng

## Trách nhiệm và giao diện

Module: **CustomerService**. Endpoint dưới đây thêm prefix `/api/v1`; payload chuẩn trong [OpenAPI](../../../contracts/openapi.yaml). [Quy ước chung](../technical-design.md) áp dụng cho tất cả.

`GET/POST /customers; GET/PATCH/DELETE /customers/{customer_id}`

## Người dùng và quyền

Teller tạo/list/sửa/archive; customer chỉ xem chính mình qua resource scope; analyst/admin không mặc nhiên có CRUD.

## Luồng xử lý

Create normalize email, validate full_name/phone và uniqueness; PATCH chỉ full_name/email/phone với expected_version. DELETE là archive, giữ PII cần cho lịch sử demo và audit, chặn nếu còn account chưa closed/pending. Không đổi customer ownership qua PATCH.

## Kết quả và trường hợp lỗi

Create 201; read/update 200; archive 204. Email duplicate hoặc stale version/active account ->409; dữ liệu sai 422; ID ngoài scope 404.

## Dữ liệu và transaction

customers lock UPDATE khi archive; tất cả account-creation/money use case lock SHARE customer trước account để tránh archive race. users.customer_id liên kết do admin gán.

## Tiêu chí nghiệm thu

CUS-01 CRUD; CUS-02 duplicate email; CUS-03 archive vs mở account đồng thời; CUS-04 version conflict; CUS-05 không mất history.

Chưa có code chạy ở checkpoint thiết kế. Test IDs là yêu cầu triển khai, không phải test đã pass.
