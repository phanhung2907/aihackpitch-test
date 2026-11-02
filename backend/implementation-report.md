# Backend implementation và kết quả kiểm thử

Checkpoint: 2026-11-03 (Asia/Bangkok). Phạm vi: backend, chưa có giao diện frontend.

## Đã triển khai

- FastAPI phục vụ 41 operations theo canonical OpenAPI, xác thực session cookie, CSRF/Origin và phân quyền/ownership.
- CRUD khách hàng/tài khoản, soft archive, trạng thái active/frozen/closed, optimistic version.
- Gửi/rút/chuyển nội bộ, tiền VND nguyên đồng, idempotency và replay resource hiện tại.
- Ba luật gian lận và LOCATION_UNAVAILABLE; evidence immutable theo rule version; debit reserve khi HOLD; analyst approve/reject.
- Reversal four-eyes bằng bút toán đối dấu; không sửa/xóa ledger gốc.
- Users/branches/rule versions, dashboard/history/audit, cursor có chữ ký và login throttling.
- PostgreSQL 17 Docker, Alembic 001–004, runtime DB role hạn quyền, immutable journal/audit, deferred balance constraints và posting functions.
- uv.lock, pinned Docker digests, lệnh chạy demo/seed/reconcile, CI workflow và scripts kiểm tra vận hành.

## Kết quả local

| Nhóm | Kết quả |
| --- | --- |
| Unit/domain | 20 tests PASS, tiền và fraud thresholds/time/location |
| Contract | 2 tests PASS, spec/examples/header policy |
| Từng chức năng | 21 tests PASS, CRUD/auth/money/review/reversal/admin/history |
| Hệ thống/integration | 18 tests PASS, PostgreSQL thật và concurrent requests |
| Tổng suite | **61/61 PASS**, 200,28 giây ở lần xác minh cuối có coverage |
| Coverage tổng (line + branch tổng hợp) | **90,29%** |
| Domain core | 100% lines, 100% branches |
| Money core | 93,4% lines, 81,2% branches |
| Ruff lint/format | PASS |
| mypy | PASS (11 source modules) |
| Audit runtime dependencies | Không phát hiện lỗ hổng đã biết tại thời điểm kiểm tra |
| Docker build và startup | PASS; migration service hoàn tất, backend healthy |
| HTTP black-box Docker | PASS: live/ready/docs/OpenAPI/login/HOLD/reject/history |
| Backup/restore | PASS: pg_dump custom format → database mới cô lập, đối soát ledger/reserves không lệch; DB gốc giữ nguyên |

Tests hệ thống chứng minh: hai rút cùng lúc không overspend; hai chuyển ngược chiều dùng thứ tự khóa thống nhất; trùng key chỉ một lệnh; approve/reject cạnh tranh chỉ một quyết định; lỗi sau money write trước audit rollback toàn bộ; runtime role không sửa ledger/số dư/số tiền lệnh trực tiếp; journal không cân bằng không commit được; thay rule không đổi evidence cũ; reconciliation lệch chặn readiness và mutation tiền.

Môi trường local tests: Windows/Python 3.13.14; container: Python 3.13.18. Tests database tách biệt `banking_test`, không dùng SQLite. Hai cảnh báo từ thư viện test hiện tại: Starlette khuyến nghị httpx2 thay httpx, và OpenAPI validator thông báo shortcut validate_spec deprecated; chúng không phải test failures. Lockfile giữ bộ thư viện đã chạy thực tế.

## TDD và các lỗi đã sửa qua kiểm thử

- RED checkpoint `1b595fb`: tests nhập module domain chưa tồn tại và fail đúng điểm chưa triển khai.
- GREEN: 17 unit tests đầu tiên đạt sau implementation; thêm boundary distance thành 20 unit tests.
- Từng chức năng: phát hiện quyền khóa admin_guard thiếu và hai PATCH admin bị mất trong bản contract thiết kế; đã sửa và kiểm thử lại.
- DB migration/seed phát hiện deferred trigger truy cập sai record field; migration 002 sửa function, 003/004 bổ sung invariant guards. Fresh schema đi qua đủ migrations trước seed.
- Sửa xử lý replay sau khi account frozen, chống role-change self-review và money-write gate khi đối soát lệch; đều có regression tests.

## Contract và thiết kế được cập nhật

Hai operations PATCH users/branches được thêm, tổng tăng từ 39 lên 41. listBranches được chuẩn hóa tên; server URL tương đối để Swagger, Vite proxy và Nginx dùng cùng origin. Consumer frontend cần generate types từ bản contract hiện tại.

Runtime validation dùng JSON Schema trực tiếp từ canonical contract cho request và response, trước commit. Không có bộ DTO Pydantic viết tay thứ hai hay independent FastAPI-generated contract để so sánh; route inventory và runtime response conformance được kiểm thử thay thế. Thay đổi kiến trúc này được ghi rõ để tránh tuyên bố drift check không thực sự chạy.

## Giới hạn và bước tiếp

Frontend/MSW/generated TypeScript, browser E2E, visual/accessibility tests và staging/production chưa được triển khai/kiểm chứng. Đây là backend MVP chạy local; các test HTTP hệ thống không thay thế browser E2E khi có frontend. CI workflow đã cấu hình; trạng thái hosted được xác minh từ run thực tế sau push, không suy ra từ local PASS.

Các bản backup nằm local trong `backend/backups/` bị gitignore; database restore có tên `banking_restore_*`. Không đưa secrets hoặc dữ liệu backup vào Git. Chủ repo kiểm tra backend trước khi mở checkpoint frontend/integration. Theo yêu cầu mới, dừng kiểm thử mở rộng; giữ unit/integration và không chạy thêm kiểm thử vận hành sâu. Bản sửa Swagger có regression test thuần Python, không cần loopback.

Swagger canonical được phục vụ bằng subclass FastAPI.openapi để không phụ thuộc cache version nội bộ của framework. Regression contract test xác minh server URL và schema trực tiếp; 61-test full suite đã chạy trước bản sửa Swagger, sau đó 3 contract tests được kiểm tra riêng.
