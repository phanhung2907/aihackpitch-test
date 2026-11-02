# Hợp đồng API dùng chung

Nguồn chuẩn: [openapi.yaml](openapi.yaml). Thiết kế nghiệp vụ: [backend design](../backend/design/README.md).

[examples.json](examples.json) chứa payload mẫu gắn schema; [scenarios.json](scenarios.json) là tiêu chí cho mock/provider/integration tests sau này. Backend đã triển khai và validate request/response bằng contract này. Có 41 operations sau khi bổ sung PATCH users/branches. Chưa generate frontend types; các scenario descriptions phải đối chiếu tests thực, không tự coi là đã chạy.

API cùng origin `/api/v1`; mọi mutation đã đăng nhập cần cookie và X-CSRF-Token, kiểm tra Origin. Money/review/reversal mutations có Idempotency-Key. Role annotations không thay thế ownership. Xem description của schema và technical design cho giới hạn tiền/transactions.

Khi đổi contract: cập nhật canonical, validate spec/examples, rà tác động hai phía, sinh types và chạy provider/consumer tests khi có code. Không tạo schema độc lập thủ công trong frontend mà bỏ qua code generation.
