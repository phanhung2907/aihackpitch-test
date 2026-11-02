# Thiết kế kỹ thuật và tính đúng đắn

## 1. Quy ước chung

UUID là string; timestamps RFC3339 UTC, received_at do server cấp. VND là chuỗi chữ số dương canonical `^[1-9][0-9]*$` cho amount; balance cho phép 0. Server parse integer, giới hạn <= 9223372036854775807 và kiểm tra cả phép cộng/sum bằng integer rộng trước khi ghi BIGINT. Không nhận float, exponent, dấu cộng, dấu phẩy hay khoảng trắng. Không làm tròn tiền.

`/api/v1`, JSON snake_case, response đơn `{data: ...}`, danh sách `{data: [...], meta: {next_cursor, limit}}`. Cursor opaque có tuple thời gian/id và hash filter, ký HMAC, không bỏ qua ownership. Limit mặc định 20, tối đa 100; sort giảm dần created_at,id. Filter sai trả 422; cursor sai trả 422.

Error `{error: {code, message, details: [{field, code, message}], request_id}}`; 401 chưa đăng nhập, 403 không có chức năng/quyền CSRF, 404 resource không tồn tại hoặc không thuộc phạm vi, 409 conflict/số dư/trạng thái/idempotency, 422 input, 429 throttle, 503 lỗi tạm thời DB/rule, 500 lỗi ngoài dự kiến. Không lộ SQL/stack. Envelope validation của FastAPI cũng phải normalize.

## 2. Trạng thái và giữ chỗ

Tài khoản: active → frozen → active; active hoặc frozen → closed nếu balance=0, reserve=0, không có pending money/reversal. closed là cuối. Không hard-delete tài khoản. Khách hàng active → archived nếu mọi tài khoản đã đóng và không có pending; archived có thể đọc lịch sử, không tạo lệnh mới. DELETE khách hàng chỉ soft-archive. User disable revoke mọi session.

Lệnh tiền được tạo và commit trực tiếp ở **posted** hoặc **pending_review**; lỗi validation/không đủ tiền không tạo lệnh accepted. pending_review → posted hoặc rejected. posted → reversed chỉ khi reversal đã posted. rejected/reversed là cuối. Reversal request có lifecycle riêng pending_review → posted/rejected, không trở thành candidate fraud. Không expose trạng thái processing giả khi DB rollback.

Alert: open → approved/rejected cùng transaction với quyết định lệnh; một alert mỗi lệnh, nhiều rule results. Reversal review riêng, không tái sử dụng fraud alert.

Reservation: active → consumed/released. Mỗi lệnh rút/chuyển hold có đúng một reserve nguồn. Balance cache accounts.posted_balance và reserved_amount cập nhật dưới row lock; available=posted-reserved. Deposit hold không reserve. Frozen cấm mọi post mới, kể cả approve; reject vẫn được giải phóng hold. Không auto-expire trong MVP, pending age hiện trên inbox.

## 3. Một UnitOfWork cho mỗi mutation tiền

1. Trước DB: nhận received_at UTC; session, CSRF, role, DTO validation. Actor/branch lấy phía server.
2. Begin READ COMMITTED. Giữ khóa SHARE trên customer liên quan theo UUID tăng dần để serialize archive với nghiệp vụ; dùng cùng thứ tự cho mọi use case. User/role được revalidate trong transaction bằng SHARE lock; admin đổi role/disable phải dùng lock UPDATE. Thứ tự tổng quát: admin_guard (chỉ admin mutations) → users → branches → customers → idempotency row → accounts theo UUID tăng dần → transaction/reversal row → reservation → journal/audit. Cash use case giữ SHARE branch để branch disable/relocate UPDATE không chen giữa kiểm tra và commit; customer SHARE và user SHARE cũng giữ đến commit. Không route nào đảo thứ tự.
3. Idempotency row unique(actor_id,key), lưu method+path+canonical body hash. INSERT ON CONFLICT và lock row; cùng key khác hash → 409 IDEMPOTENCY_CONFLICT. Row chỉ tồn tại khi mutation thành công commit. Với key tồn tại và completed, trả cùng resource + HTTP status gốc sau recheck quyền; representation phản ánh trạng thái hiện tại, không trả snapshot pending cũ. Cờ Idempotency-Replayed=true. Không chạy rule/post lần nữa.
4. Lock mọi accounts liên quan theo UUID, kể cả clearing; recheck owner/status, available và overflow. Query lookup không được SELECT FOR UPDATE transaction trước account. Với review/reversal: đọc account IDs bất biến trước, lock accounts rồi lock command, recheck status/version. Không đổi account IDs của lệnh.
5. Chỉ nguồn khởi tạo (deposit/withdraw account hoặc transfer source) được gán account_sequence tăng đơn điệu dưới khóa. Received_at giữ thời gian nhận thật; sequence là thứ tự xử lý. Với hai request out-of-order, rapid rule dùng `abs(current.received_at - candidate.received_at) <= 30s` trên các candidate đã serialize trước để không bỏ lọt cặp; đây là làm rõ đối xứng cửa sổ của plan. Evidence lưu cả received_at và sequence. Không tạo sequence cho retry/reversal.
6. Nạp active rule version (một snapshot bất biến) và candidate posted/pending_review chưa rejected/reversed. Distant dùng candidate có sequence lớn nhất, rapid dùng các candidate amount >500 triệu trong ±30s. Inbound transfer không phải candidate của tài khoản nhận. Không scan toàn bộ ledger.
7. FraudService trả allow hoặc hold, toàn bộ matched/unevaluated rules và evidence. Thiếu vị trí current hoặc candidate trước → LOCATION_UNAVAILABLE; tọa độ sai bị chặn trước acceptance. Rule exception → rollback, 503.
8. ALLOW: LedgerService post journal cân bằng và balance caches. HOLD: tạo command pending, alert, evaluation và reserve nếu debit. Một transaction DB ghi command/evaluation/audit/idempotency cùng nhau. Nếu bất kỳ ghi nào lỗi, rollback tất cả. Không trả success trước commit.
9. Commit, serialize resource. Mất kết nối sau commit: client giữ key, retry hoặc GET transaction để biết kết quả.

Đối xứng ±30s chỉ xử lý arrival/lock ordering, không tin timestamp client và không xét lệnh chưa được serialize. Khi hai received_at bằng nhau sequence vẫn phân biệt. Phải đồng bộ clock host; received_at không thay bằng DB transaction-start timestamp sau đợi lock. Query rapid có index account/received_at với bộ lọc amount/status.

## 4. Ledger double-entry

Để người đọc dễ kiểm tra, entry dùng **signed delta** đối với số dư giữ hộ, không dùng thuật ngữ debit/credit mơ hồ. Với amount A: deposit = clearing −A, customer +A; withdrawal = customer −A, clearing +A; transfer = source −A, destination +A. Tổng delta mỗi journal = 0. Hệ thống clearing có thể âm, account khách hàng không âm; clearing không xuất hiện trong API tài khoản customer.

Journal và entries chỉ INSERT. Mỗi command posted có đúng một journal; reversal có một journal mới liên kết original_journal_id unique, delta là âm các entry cũ. Deferred constraint trigger kiểm tra tối thiểu 2 dòng, tổng bằng 0 và net đúng command khi commit. Revoke direct update/delete journal/entry, balance cache chỉ được viết qua trusted database posting function đã khóa account và kiểm tra trạng thái. Function kiểm tra amount, account kind, không cho arbitrary entry injection. ORM gọi một interface duy nhất, không sửa balance tự do.

Reconcile định kỳ bằng SUM(delta) NUMERIC so với posted_balance và SUM(active reserve) so với reserved_amount. Lệch thì readiness tài chính fail/disable mutations, báo lỗi cần điều tra; không tự sửa ledger theo cache.

## 5. Idempotency, concurrency và failure matrix

| Tình huống | Hành vi |
| --- | --- |
| Double click cùng key/body | Một command/reserve/journal; request sau replay resource |
| Cùng key khác endpoint/body | 409, không ghi tiền |
| Hai withdraw cùng số dư | Locks serialize; lệnh sau dùng available mới, có thể 409 |
| Chuyển A→B và B→A | Lock accounts theo UUID, không theo source/destination |
| Hai analyst approve/reject | Lock accounts rồi command; một transition thắng; quyết định sau 409 |
| Khóa account và approve đồng thời | Cùng row lock; thứ tự commit quyết định, không post vào account đã frozen |
| Lock timeout/deadlock | Rollback toàn bộ, 503 RETRYABLE_CONFLICT; không tự retry vô hạn |
| Timeout sau commit | Retry cùng key trả resource, không tạo lệnh mới |
| Rule/DB/audit lỗi trước commit | Không money mutation được giữ; 503 hoặc 500 phù hợp |
| Approve không còn hợp lệ | 409; giữ pending và reserve; reject vẫn giải phóng được |

Lock timeout 3s, statement timeout 10s, request timeout proxy 20s cho local MVP; tune theo đo đạc. Services không thực hiện network call trong lock. Idempotency giữ suốt vòng đời dữ liệu demo, không cleanup tự động làm mất bảo vệ retry. Mutations review/reversal cũng bắt buộc Idempotency-Key.

## 6. Bảo mật và auth boundary

Session 256-bit random opaque; cookie token chỉ gửi browser, DB lưu SHA-256 hash. Session sống tối đa 8 giờ; login mới rotate, logout/disable/change role revoke. User role không lấy từ cookie. CSRF random token gắn session, frontend lấy qua GET session; mutation so sánh header X-CSRF-Token constant time và Origin exact. Login yêu cầu Origin hợp lệ và JSON, không dùng session cũ để elevate.

Mật khẩu Argon2id, parameters benchmark ở bootstrap; login thất bại generic. Throttle trên hash normalized login + source IP: 5 thất bại/15 phút, 429 + Retry-After; record counter atomic trong transaction riêng để thất bại login không rollback counter. Fake hash cho user không có để giảm user enumeration; không log login plaintext. Trust forwarded IP chỉ từ Nginx đã allowlist.

Auth endpoint commit session trước Set-Cookie. Các endpoint nhận session không cache public. Query/response PII tối thiểu; customer không xem vị trí/evidence của người khác. Audit transactional cho mutations thành công; auth failure log được redacted và persisted riêng. SQL parameter binding qua ORM, forbidden field reject qua extra=forbid.

## 7. Tổ chức backend dự kiến

`app/api/v1`, `app/schemas`, `app/application`, `app/domain/{money,fraud}`, `app/infrastructure/{db,repositories}`, `app/core/{config,security,observability}`, `migrations`, `tests/{unit,integration,contract}`. Router mỏng, service nhận UnitOfWork/clock/rule config. Không import frontend vào backend. Canonical OpenAPI nằm tại repo `contracts/openapi.yaml`, chưa có route chạy thật trong bước này.

Posting function là SECURITY DEFINER có owner riêng, search_path cố định và tên bảng fully-qualified; runtime chỉ được EXECUTE interface hẹp. Không nhận journal entries tùy ý từ API. Các row locks và constraint triggers phải được integration test bằng runtime role, không chỉ bằng superuser.
