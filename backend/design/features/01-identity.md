# F01 — Đăng nhập, session và phân quyền

## Trách nhiệm và giao diện

Module: **IdentityService**. Endpoint dưới đây thêm prefix `/api/v1`; payload chuẩn trong [OpenAPI](../../../contracts/openapi.yaml). [Quy ước chung](../technical-design.md) áp dụng cho tất cả.

`POST /auth/login; GET /auth/session; DELETE /auth/session`

## Người dùng và quyền

Mọi người dùng; GET/DELETE session phải có session hợp lệ.

## Luồng xử lý

Login kiểm tra Origin, JSON và throttle. Verify Argon2id (dummy hash nếu user không tồn tại); enabled=true thì tạo token 256-bit, hash token vào DB, cookie và CSRF theo technical-design. GET session trả user/role và csrf_token, không trả cookie token. Logout revoke và clear cookie; logout lại với session hết hạn trả 204 để UX ổn định.

## Kết quả và trường hợp lỗi

Login 200; session 200; logout 204. Sai login 401 generic, throttle 429, CSRF/Origin 403. Cookie HttpOnly/SameSite=Lax, 8 giờ; Secure ngoài local explicit.

## Dữ liệu và transaction

sessions, users, login_throttles; login failure counters trong transaction độc lập, không rollback cùng lỗi auth.

## Tiêu chí nghiệm thu

AUTH-01 đúng/sai password; AUTH-02 role/ownership 403/404; AUTH-03 hết hạn/revoke/rotate; AUTH-04 CSRF; AUTH-05 throttle concurrent; AUTH-06 không log secret.

Chưa có code chạy ở checkpoint thiết kế. Test IDs là yêu cầu triển khai, không phải test đã pass.
