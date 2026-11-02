# Thiết kế backend — Banking webapp

Trạng thái: thiết kế nền cho backend đã triển khai. Xem [kết quả implementation/testing](../implementation-report.md); frontend chưa triển khai. Nguồn yêu cầu: [kế hoạch](../../plans/banking-webapp-plan.md), đặc biệt mục 12.

## Đọc theo thứ tự

1. [Sơ đồ sản phẩm từ A đến Z](product-flow.md): dành cho người mới, có chú giải hình và mũi tên.
2. [Kiến trúc hệ thống](system-design.md): thành phần, trách nhiệm, ranh giới bảo mật và dữ liệu.
3. [Thiết kế kỹ thuật](technical-design.md): transaction, khóa, ledger, trạng thái và xử lý lỗi.
4. [Mô hình dữ liệu](data-model.md): bảng, ràng buộc, index và quan hệ.
5. Các chức năng trong bảng dưới; [hợp đồng API](../../contracts/openapi.yaml) là nguồn chuẩn cho payload.
6. [Kiểm thử và tích hợp](verification.md): điều kiện nghiệm thu để frontend/backend làm song song.

| ID | Chức năng | Tài liệu |
| --- | --- | --- |
| F01 | Đăng nhập, phiên và quyền | [identity](features/01-identity.md) |
| F02 | CRUD khách hàng | [customers](features/02-customers.md) |
| F03 | CRUD và vòng đời tài khoản | [accounts](features/03-accounts.md) |
| F04 | Gửi tiền | [deposits](features/04-deposits.md) |
| F05 | Rút tiền | [withdrawals](features/05-withdrawals.md) |
| F06 | Chuyển nội bộ | [transfers](features/06-transfers.md) |
| F07 | Phát hiện gian lận | [fraud](features/07-fraud.md) |
| F08 | Duyệt/từ chối giao dịch | [review](features/08-review.md) |
| F09 | Đảo giao dịch | [reversals](features/09-reversals.md) |
| F10 | Lịch sử, dashboard và audit | [history](features/10-history.md) |
| F11 | Users, chi nhánh và cấu hình luật | [administration](features/11-administration.md) |
| F12 | Khởi động, seed, backup và vận hành | [operations](features/12-operations.md) |

## Từ điển dùng thống nhất

- **Người dùng**: người đăng nhập; mỗi người có một vai trò.
- **Khách hàng**: chủ tài khoản; có thể được gắn với người dùng vai trò customer.
- **Tài khoản**: nơi thể hiện số dư VND. Không đồng nghĩa với tài khoản đăng nhập.
- **Lệnh giao dịch**: yêu cầu gửi/rút/chuyển, có thể chưa thay đổi số dư.
- **Bút toán**: dòng tăng/giảm tiền bất biến, chỉ tạo khi lệnh được ghi sổ.
- **Số dư đã ghi sổ**: tổng bút toán của tài khoản; **tiền giữ chỗ**: tiền dành cho lệnh chờ; **số dư khả dụng** = đã ghi sổ − giữ chỗ.
- **Cảnh báo**: lý do nghi ngờ để người kiểm duyệt xem xét; không phải kết luận gian lận.
- **Người kiểm duyệt**: người dùng fraud_analyst, khác người tạo lệnh.
- **Ghi sổ**: commit đồng thời bút toán, số dư, trạng thái, audit và kết quả retry vào PostgreSQL.

Tài liệu mô tả thiết kế, không chứng minh hệ thống đang chạy. Exact package patches/digests được khóa và kiểm thử ở bootstrap. ECC chỉ ở local, không xuất bản cùng repo.
