# Kế hoạch xây dựng banking webapp và phát hiện gian lận

Ngày: 2026-11-02 (Asia/Bangkok). Trạng thái: BƯỚC 1 — CHỜ CHỦ REPO DUYỆT.

## 1. Mục tiêu và phạm vi

Xây dựng webapp mô phỏng nghiệp vụ ngân hàng: quản lý khách hàng, tài khoản, gửi tiền, rút tiền, chuyển tiền nội bộ, lịch sử giao dịch và phát hiện giao dịch đáng ngờ bằng luật có giải thích. Backend bắt buộc Python/FastAPI; PostgreSQL chạy Docker. Frontend và backend nằm trong hai thư mục riêng, phát triển song song sau khi duyệt thiết kế và hợp đồng API.

Phạm vi bàn giao đầu tiên là sản phẩm demo với tiền và dữ liệu giả lập. Kết nối ngân hàng thật, thanh toán liên ngân hàng, lãi suất, vay, thẻ, eKYC và vận hành tiền thật chưa nằm trong yêu cầu đã xác nhận. Không coi một cảnh báo theo luật là kết luận gian lận đã được chứng minh.

Mỗi bước: thực hiện phạm vi đã duyệt → kiểm tra → cập nhật context → commit → push → xác minh remote → báo cáo và DỪNG. Chủ repo duyệt mới chuyển bước. Cho phép làm song song frontend/backend trong cùng một mốc đã duyệt, không tự động vượt mốc.

## 2. Yêu cầu đã xác nhận và các giả định cần duyệt

| Nội dung | Yêu cầu / đề xuất |
| --- | --- |
| Backend | Python, FastAPI |
| Database | PostgreSQL trong Docker, volume lưu dữ liệu |
| Cấu trúc | `frontend/` và `backend/` |
| Phát triển song song | Frontend chạy bằng mock đúng hợp đồng; đổi cấu hình để gọi API thật |
| Tiền tệ | Đề xuất chỉ VND, số nguyên đồng, không dùng float; API truyền tiền dạng chuỗi chữ số |
| Khách hàng và tài khoản | CRUD; đóng/lưu trữ thay vì xóa dữ liệu đã có giao dịch |
| Giao dịch | Tạo và đọc; không sửa/xóa bút toán đã ghi sổ. Sửa sai bằng giao dịch đảo có liên kết và quyền hạn |
| Số tiền lớn | Nghi ngờ nếu số tiền một giao dịch > 1.000.000.000 VND |
| Khoảng cách | Yêu cầu là hai giao dịch gần nhất ở địa điểm quá xa; đề xuất khoảng cách > 500 km. Đây là ngưỡng chờ duyệt, không phải yêu cầu đã chốt |
| Tốc độ giao dịch lớn | Hai giao dịch, mỗi giao dịch > 500.000.000 VND, cùng tài khoản, cách nhau <= 30 giây |
| Xử lý nghi ngờ | Đề xuất HOLD trước ghi sổ; người kiểm duyệt có thể duyệt hoặc từ chối, lưu lý do và audit |
| Quyền | Đề xuất customer, teller, fraud_analyst, admin; chốt ma trận quyền ở bước 2 |
| Frontend | Chọn framework, thư viện UI, công cụ mock và phiên bản tại bước 2; không chốt phụ thuộc trước khi kiểm tra tương thích |
| Địa điểm | Demo nhận tọa độ hợp lệ kèm nguồn; dữ liệu client có thể giả mạo. Nguồn đáng tin và chính sách thiếu vị trí cần chốt |
| Triển khai | Local Docker trước; môi trường staging/production và nhà cung cấp chờ xác định |

Nếu chủ repo muốn sửa/xóa trực tiếp giao dịch, phải thống nhất lại mô hình kế toán trước khi triển khai. Đề xuất chuyển tiền nội bộ để kiểm tra tính nguyên tử giữa hai tài khoản, nhưng có thể bỏ khỏi MVP nếu chỉ cần gửi/rút.

## 3. Phân rã chức năng

### 3.1 Danh tính và phân quyền

Đăng nhập/đăng xuất, thông tin người dùng hiện tại, kiểm tra quyền phía server và quyền sở hữu tài khoản. Tài khoản demo được seed có kiểm soát. Không cho frontend tự quyết định vai trò hoặc số dư. Chính sách phiên đăng nhập, lưu token/cookie và CSRF sẽ được thiết kế ở bước 2.

### 3.2 Khách hàng và tài khoản

- Danh sách, tìm kiếm, phân trang, xem chi tiết, tạo, cập nhật thông tin hợp lệ, lưu trữ khách hàng.
- Mở tài khoản, xem số dư, cập nhật nhãn/thông tin cho phép, khóa và đóng tài khoản theo quyền.
- Không đóng tài khoản còn tiền hoặc giao dịch chờ; không xóa khách hàng có lịch sử tài chính.
- Tài khoản bị khóa/đóng không được gửi lệnh tiền trái chính sách. Mã định danh không bị tái sử dụng.

### 3.3 Gửi, rút, chuyển tiền và lịch sử

- Gửi tiền demo, rút khi đủ số dư khả dụng, chuyển nội bộ với debit/credit nguyên tử.
- Số tiền dương; từ chối số âm, 0, sai định dạng, vượt giới hạn lưu trữ và chuyển cho chính tài khoản.
- Idempotency cho yêu cầu thay đổi tiền: retry cùng key và cùng payload trả lại kết quả cũ; khác payload báo conflict.
- Lịch sử có lọc thời gian, loại, trạng thái, tài khoản và phân trang; chi tiết hiển thị kết quả phát hiện gian lận theo quyền.
- Trạng thái đề xuất: pending_review, posted, rejected, reversed. Luồng chuyển trạng thái và mã lỗi chốt ở hợp đồng.
- Duyệt một lệnh đang hold phải kiểm tra lại số dư, trạng thái tài khoản và quyền tại lúc ghi sổ. Không ghi sổ hai lần.

### 3.4 Phát hiện và xử lý gian lận

| Rule ID | Điều kiện đề xuất | Test biên bắt buộc |
| --- | --- | --- |
| HIGH_AMOUNT | amount > 1.000.000.000 | đúng 1 tỷ không match, 1 tỷ + 1 match |
| DISTANT_LOCATIONS | Khoảng cách hai giao dịch liên tiếp cùng tài khoản > ngưỡng km | dưới/bằng/trên ngưỡng; cùng vị trí; thiếu vị trí; tọa độ sai |
| RAPID_LARGE_TRANSACTIONS | Có giao dịch trước > 500 triệu và lệnh hiện tại > 500 triệu trong cửa sổ 30 giây | đúng 500 triệu không match; 500 triệu + 1; 29,999s/30s/30,001s |

Ngữ nghĩa đề xuất để duyệt: dùng thời gian nhận tại server UTC, cửa sổ đóng [t-30s, t]; so với các lệnh hợp lệ đã được chấp nhận trước đó (posted hoặc pending_review), loại lệnh rejected, validation failure và retry trùng key. Luật khoảng cách so với lệnh hợp lệ liền trước theo thứ tự xử lý được serialize; luật tốc độ tìm mọi lệnh lớn phù hợp trong cửa sổ, không chỉ giao dịch liền trước. Một lệnh có thể match nhiều luật, không nhân đôi bút toán.

Chuyển tiền đánh giá tài khoản nguồn là bên khởi tạo; khoản credit nhận tiền không được tính như một thao tác có mặt tại địa điểm của người nhận. Thiết kế sẽ quyết định cách áp dụng quy tắc cho gửi/rút của giao dịch viên. Khi thiếu vị trí, không tự coi khoảng cách là 0 hoặc coi kiểm tra đã đạt; đề xuất hold với lý do riêng LOCATION_UNAVAILABLE. Trình bày khả năng false positive và cho phép cấu hình ngưỡng có phiên bản/audit.

Màn hình kiểm duyệt: danh sách cảnh báo, rule khớp và bằng chứng (amount, timestamps, distance), giao dịch liên quan, duyệt/từ chối có lý do, lọc trạng thái và người xử lý. Người tạo lệnh không tự duyệt lệnh của mình theo đề xuất phân tách nhiệm vụ.

## 4. Các bất biến bắt buộc

1. Không dùng số thực cho tiền; ledger và số dư không sai khác sau lỗi hoặc retry.
2. Không overdraft do hai lệnh rút đồng thời. Khóa và transaction DB bảo vệ kiểm tra số dư lẫn ghi sổ.
3. Chuyển nội bộ hoặc hoàn tất cả hai phía hoặc không thay đổi phía nào; tổng debit/credit cân bằng theo mô hình ledger được duyệt.
4. Các lệnh cùng tài khoản được đánh giá gian lận nhất quán khi đến đồng thời; thứ tự khóa tránh deadlock cho chuyển khoản.
5. HOLD không làm tăng/giảm số dư đã ghi sổ; cách reserve số dư khả dụng phải được chốt, kiểm thử và hiển thị rõ.
6. Ghi giao dịch, quyết định rule và audit trong cùng ranh giới nhất quán; lỗi engine không được âm thầm cho qua.
7. Lịch sử bút toán và quyết định không bị xóa để che dấu sai sót; hành động nhạy cảm có actor, thời gian, correlation ID.
8. Không lộ dữ liệu tài khoản khác do đoán ID; lọc quyền ở API, không chỉ ẩn nút frontend.

## 5. Cấu trúc repo dự kiến

```text
frontend/                  # ứng dụng web, generated types, mock handlers, tests
backend/                   # FastAPI, migrations, domain/services, tests
contracts/                 # OpenAPI canonical + examples + scenario fixtures
plans/                     # kế hoạch và checkpoints
docs/                      # thiết kế, tạo ở bước 2
context/                   # handoff, project facts, work log
compose.yaml               # Postgres và dịch vụ local, tạo khi bootstrap
.github/workflows/         # CI tạo khi đã có commands thực tế
```

ECC chỉ cài local và bị gitignore. Bước 1 chỉ tạo README định hướng ở frontend/backend, chưa bootstrap hay cài dependency.

## 6. Hợp đồng API và mock để phát triển song song

Bước 2 tạo `contracts/openapi.yaml` làm nguồn chuẩn duy nhất, có schemas, required/nullability, enum trạng thái, định dạng tiền và UTC, phân trang, xác thực, idempotency, response lỗi và examples. Backend và frontend cùng rà soát theo nhu cầu màn hình; chủ repo duyệt contract trước khi coding song song.

Nhóm API dự kiến: auth/session, customers, accounts, deposits, withdrawals, transfers, transactions, fraud alerts, review decisions. Tên đường dẫn, HTTP codes và payload chính thức thuộc bước thiết kế, chưa được định nghĩa bởi danh sách này.

Frontend sinh types từ OpenAPI và dùng HTTP mock adapter (công cụ cụ thể chọn ở bước 2). Components gọi một API client duy nhất; không chứa điều kiện mock trong UI. Mock ở tầng HTTP, có store có trạng thái và fixtures giả lập, mô phỏng success, validation, unauthorized, forbidden, not-found, insufficient-funds, conflict, hold, timeout. Không gọi backend để chạy chế độ mock.

Backend triển khai đúng schemas/semantics và kiểm tra schema responses với contract. CI so sánh OpenAPI do FastAPI cung cấp với contract canonical theo phương pháp được chốt, phát hiện thay đổi không tương thích. Không duy trì hai bản contract thủ công không được so sánh.

Kịch bản fixtures dùng ID cố định, đồng hồ có kiểm soát, dữ liệu tiền/vị trí tổng hợp; bao gồm ba luật riêng lẻ, nhiều luật cùng khớp, giao dịch hợp lệ, race condition và idempotency. Mock và API thật phải vượt cùng acceptance scenarios; fake UI success không được coi là backend đã hoạt động.

Thay contract: đề xuất → rà soát tác động hai bên → duyệt → cập nhật canonical, generated types, fixtures và provider tests trong một thay đổi phối hợp. Hai bên không tự thêm enum/field ngoài contract. Khi tích hợp, đổi API base URL/chế độ mock, không sửa business logic màn hình.

## 7. Roadmap, phụ thuộc và checkpoint

| Bước | Phạm vi / đầu ra | Điều kiện nghiệm thu | Phụ thuộc |
| --- | --- | --- | --- |
| 1 | Kế hoạch này; README frontend/backend; context | Đủ yêu cầu, giả định, acceptance, parallel strategy; commit/push rồi dừng | Hiện tại |
| 2 | `docs/technical-design.md`, `docs/system-design.md`, `docs/flows.md`, OpenAPI và scenarios mẫu | Chủ repo duyệt kiến trúc, ERD, sequence/state Mermaid, transaction/locking, rule semantics, ma trận quyền và contract | Duyệt 1 |
| 3 | Bootstrap hai ứng dụng, Postgres Docker, migrations ban đầu, scripts kiểm tra và CI nền | Khởi động từ clone sạch; health/readiness; migrate DB mới; CI thực sự chạy; mocks/types sinh được | Duyệt 2 |
| 4 | Song song A: frontend CRUD và nghiệp vụ tiền với mock. B: backend auth/CRUD/ledger/nghiệp vụ tiền | Frontend chạy độc lập; backend tests trên Postgres thật; contract tests; kiểm tra quyền và race conditions | Duyệt 3 |
| 5 | Song song A: UI cảnh báo/review. B: rule engine, hold/review/audit | Ba luật và toàn bộ biên thời gian/tiền/vị trí; duyệt đồng thời không double-post; UI mock đủ trạng thái | Duyệt 4 |
| 6 | Tích hợp frontend/API thật, seed demo, xử lý drift | Cùng scenario suite qua mock và thật; E2E CRUD, gửi/rút/chuyển, hold/review; restart vẫn giữ dữ liệu | Duyệt 5 |
| 7 | Hardening, runbook, release candidate và demo | CI xanh; security review; backup/restore diễn tập local; hướng dẫn chạy và rollback; báo cáo giới hạn | Duyệt 6 |

Không triển khai tiếp bước 2 trong commit bước 1. Với bước song song 4/5, cả hai nhánh nằm trong cùng checkpoint: hoàn thành, tích hợp và báo cáo rồi dừng. Có thể chia nhỏ checkpoint nếu chủ repo yêu cầu; không tự coi việc duyệt một nhánh là duyệt nhánh còn lại.

### Hướng dẫn thực thi từng bước

- Bước 2: đọc plan và context, kiểm tra docs chính thức khi chọn phiên bản/công nghệ; tạo thiết kế và contract; lint/validate OpenAPI, resolve local refs, render/kiểm tra Mermaid và tính nhất quán ví dụ; không viết app.
- Bước 3: đọc thiết kế đã duyệt; khóa dependencies, tạo `.env.example` không chứa secret, healthcheck và volume; chạy lint/type/unit/build, migrate một DB mới và restart persistence. Không ghi đè dữ liệu local đã có.
- Bước 4: backend viết test hành vi lỗi/race trước implementation; frontend xây UI theo generated types và mock HTTP. Mỗi lane có README commands. Exit: không sửa contract ngầm, không dùng SQLite thay Postgres cho integration tài chính.
- Bước 5: rule functions dùng clock cố định và transaction orchestration có integration tests; frontend hiển thị evidence và lifecycle review. Exit: fixtures bắt đủ ba luật và các biên, audit và quyền được chứng minh bằng tests.
- Bước 6: dựng stack local, seed dữ liệu giả, chạy cùng journeys trên API thật; kiểm tra precision số tiền, UTC, CORS/session, error mapping và retry. Exit: mock không bị bật trong bản tích hợp thật.
- Bước 7: chạy toàn bộ quality gates, dependency scan theo công cụ đã chọn, review auth/secrets/audit, hướng dẫn backup/restore và migration rollback. Staging chỉ chạy nếu đã có đích và quyền; chưa có thì ghi NOT PERFORMED, không tuyên bố deployed.

### Quy tắc phối hợp song song

Frontend lane chỉ sở hữu `frontend/`; backend lane sở hữu `backend/`; người tích hợp sở hữu contracts, compose và workflows dùng chung. Dùng worktree/branch riêng (`codex/frontend-...`, `codex/backend-...`) để tránh stage thay đổi của agent khác. Sau khi kiểm tra, tích hợp tuần tự; không force-push. Cập nhật context bằng ghi chú từng lane rồi người tích hợp hợp nhất handoff. Không chạy nhiều migration writer hoặc sửa contract cạnh tranh mà không phối hợp.

## 8. Thiết kế cần bàn giao ở bước 2

- Thiết kế kỹ thuật: module boundaries, stack/versions, auth/session, API contract, money model, migrations/indexes, locking/isolation, idempotency, failure recovery, error model, configuration và observability.
- Thiết kế hệ thống: Mermaid context/container, ERD, trust boundaries; bảng dữ liệu dự kiến users/customers/accounts/transactions/ledger_entries/fraud_evaluations/alerts/review_actions/idempotency_records/audit_logs. Đây là danh sách để phân tích, chưa phải schema đã chốt.
- Thiết kế luồng: Mermaid sequence gửi/rút/chuyển, hai lệnh đồng thời, retry, rule evaluation, hold/approve/reject, rollback; state diagram vòng đời tài khoản/giao dịch/cảnh báo.
- Thiết kế frontend: màn hình đăng nhập/dashboard/customers/accounts/transaction form/history/fraud inbox/detail, loading/empty/error states, validation, accessibility và responsive.
- Mô tả chính xác timestamp, candidate history, location provenance, distance algorithm, reservation và quyết định khi rule engine/DB lỗi.

## 9. Ma trận kiểm thử và CI/CD theo ECC

| Tầng | Kiểm chứng |
| --- | --- |
| Backend unit | Tiền và validation; từng luật/biên; trạng thái; quyền |
| Backend integration | Postgres transaction rollback, locking, đồng thời, idempotency, migrations, audit |
| Contract | OpenAPI hợp lệ; schema examples/mocks/provider; generated types không drift |
| Frontend | Forms và validation; số tiền hiển thị; bảng/filter; hold/review; lỗi và role-based UI |
| E2E | Đăng nhập → CRUD → gửi/rút → history; cảnh báo mỗi luật; approve/reject; quyền sai; retry |
| Security | Ownership/IDOR, role escalation, session, input, secret hygiene, dependency findings |
| Persistence | Restart Postgres không mất ledger; backup/restore và ledger reconciliation |

CI bước 3 trở đi chạy trên push/PR: frontend lint/type/test/build; backend lint/type/pytest; integration với Postgres service; validate contract và generated artifacts; checks trên paths liên quan nhưng các thay đổi contract phải trigger cả hai. Tool/commands chính xác được thêm cùng bootstrap, không giả định đã có npm/pytest scripts trong repo hiện tại.

Theo ECC: TDD cho thay đổi hành vi; self-review diff; sửa lỗi do thay đổi; báo kết quả thực tế. Đề xuất coverage >= 80% cho module core nghiệp vụ, bổ sung case ledger/concurrency bắt buộc; coverage cao không thay thế kiểm thử bất biến. Chốt và cấu hình threshold ở bước 3.

CD chưa tự động production. Khi có môi trường được duyệt: build artifact có version, deploy staging, migrate có kiểm soát, smoke test, approve release và có rollback tương thích schema. Phân biệt local PASS, hosted CI PASS và target verification; không ghi success cho bước chưa chạy.

## 10. Rủi ro và cách giảm

- False positives: ngưỡng cấu hình, evidence, workflow review, phiên bản rule; không gọi cảnh báo là gian lận chắc chắn.
- Mất tiền/double-spend: ledger bất biến, DB transaction/locks, idempotency và concurrency integration tests.
- Thiếu/tamper vị trí: lưu provenance, validation, trạng thái chưa xác minh và chính sách hold được duyệt.
- Contract drift: canonical OpenAPI, generation và contract CI hai phía.
- Context giữa agents: đọc context và commit thực tế; ownership/worktrees; cập nhật handoff từng checkpoint.
- Quy trình bị chạy quá bước: yêu cầu approval explicit trong AGENTS và handoff; mỗi bước có commit riêng.

## 11. Checklist để chủ repo duyệt kế hoạch

- [ ] Đồng ý phạm vi demo, customer/account CRUD, gửi/rút và đề xuất chuyển nội bộ.
- [ ] Đồng ý bất biến tiền/ledger và đảo giao dịch thay sửa/xóa bút toán.
- [ ] Chốt khoảng cách (đề xuất > 500 km), lịch sử lệnh và cách xử lý thiếu vị trí.
- [ ] Đồng ý > 1 tỷ; mỗi lệnh > 500 triệu trong <= 30 giây, dùng thời gian server.
- [ ] Chốt HOLD/review, vai trò và cách giữ số dư khả dụng ở bước thiết kế.
- [ ] Đồng ý roadmap 7 bước, contract-first/mocks và checkpoint sau mỗi bước.

Chủ repo có thể duyệt kế hoạch kèm chỉnh các đề xuất. Sau duyệt bước 1, bước 2 sẽ biến các lựa chọn đã thống nhất thành thiết kế và hợp đồng có thể kiểm chứng.
