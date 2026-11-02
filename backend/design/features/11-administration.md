# F11 — Users, chi nhánh và cấu hình luật

## Trách nhiệm và giao diện

Module: **AdminService**. Endpoint dưới đây thêm prefix `/api/v1`; payload chuẩn trong [OpenAPI](../../../contracts/openapi.yaml). [Quy ước chung](../technical-design.md) áp dụng cho tất cả.

`GET/POST /users; PATCH /users/{user_id}; GET/POST /branches; PATCH /branches/{branch_id}; GET /fraud-rule-versions; POST /fraud-rule-versions`

## Người dùng và quyền

Chỉ admin; không tự grant quyền money. Thay role/disable revoke session; không disable admin cuối đang enabled.

## Luồng xử lý

User create password gửi một lần qua JSON local, hash Argon2, không response lại. Role/customer/branch mapping validate. Branch coordinates paired/range, referenced branch không hard-delete; disable cấm teller tạo cash mới. Rule change tạo immutable version và swap active pointer expected_version; thresholds positive, rapid_seconds integer 1..3600, distance 1..20040km; defaults đúng plan. Không disable rule trong MVP.

## Kết quả và trường hợp lỗi

201 create, 200 patch/read; duplicate/version/last-admin 409, bad mapping 422. Reason bắt buộc cho config/state/role changes.

## Dữ liệu và transaction

Admin mutations lock user rows sorted và singleton admin_guard để serialize last-admin count; branch UPDATE so với cash use case SHARE; rule config row UPDATE, audit cùng UoW. In-flight lệnh giữ rule snapshot cũ đến commit.

## Tiêu chí nghiệm thu

ADM-01 role escalation; ADM-02 last-admin concurrent; ADM-03 disable session revoke; ADM-04 immutable rule/evidence; ADM-05 branch location không bị client giả.

Chưa có code chạy ở checkpoint thiết kế. Test IDs là yêu cầu triển khai, không phải test đã pass.
