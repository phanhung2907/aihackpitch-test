# Kế hoạch xây dựng banking webapp và phát hiện gian lận

Ngày: 2026-11-02 (Asia/Bangkok). Trạng thái: backend đã được thiết kế và triển khai/kiểm thử theo ủy quyền mới; frontend chưa triển khai.

## 1. Mục tiêu và phạm vi

Xây dựng webapp mô phỏng nghiệp vụ ngân hàng: quản lý khách hàng, tài khoản, gửi tiền, rút tiền, chuyển tiền nội bộ, lịch sử giao dịch và phát hiện giao dịch đáng ngờ bằng luật có giải thích. Backend bắt buộc Python/FastAPI; PostgreSQL chạy Docker. Frontend và backend nằm trong hai thư mục riêng, phát triển song song sau khi duyệt thiết kế và hợp đồng API.

Phạm vi bàn giao đầu tiên là sản phẩm demo với tiền và dữ liệu giả lập. Kết nối ngân hàng thật, thanh toán liên ngân hàng, lãi suất, vay, thẻ, eKYC và vận hành tiền thật chưa nằm trong yêu cầu đã xác nhận. Không coi một cảnh báo theo luật là kết luận gian lận đã được chứng minh.

Mỗi bước: thực hiện phạm vi đã duyệt → kiểm tra → cập nhật context → commit → push → xác minh remote → báo cáo và DỪNG. Chủ repo duyệt mới chuyển bước. Cho phép làm song song frontend/backend trong cùng một mốc đã duyệt, không tự động vượt mốc.

## 2. Yêu cầu và quyết định đã chốt theo ủy quyền

| Nội dung | Quyết định |
| --- | --- |
| Backend | Python, FastAPI |
| Database | PostgreSQL trong Docker, volume lưu dữ liệu |
| Cấu trúc | `frontend/` và `backend/` |
| Phát triển song song | Frontend chạy bằng mock đúng hợp đồng; đổi cấu hình để gọi API thật |
| Tiền tệ | Chỉ VND, số nguyên đồng, không dùng float; API truyền tiền dạng chuỗi chữ số |
| Khách hàng và tài khoản | CRUD; đóng/lưu trữ thay vì xóa dữ liệu đã có giao dịch |
| Giao dịch | Tạo và đọc; không sửa/xóa bút toán đã ghi sổ. Sửa sai bằng giao dịch đảo có liên kết và quyền hạn |
| Số tiền lớn | Nghi ngờ nếu số tiền một giao dịch > 1.000.000.000 VND |
| Khoảng cách | Khoảng cách Haversine > 500 km giữa hai lệnh liên tiếp của cùng tài khoản; không thêm điều kiện thời gian cho luật này |
| Tốc độ giao dịch lớn | Hai giao dịch, mỗi giao dịch > 500.000.000 VND, cùng tài khoản, cách nhau <= 30 giây |
| Xử lý nghi ngờ | HOLD trước ghi sổ; người kiểm duyệt có thể duyệt hoặc từ chối, lưu lý do và audit |
| Quyền | customer, teller, fraud_analyst, admin; chính sách cụ thể tại mục 12 |
| Frontend | React + TypeScript + Vite; Tailwind CSS + shadcn/ui; React Router; TanStack Query; MSW; chi tiết tại mục 12 |
| Địa điểm | Nguồn vị trí demo có provenance; thiếu vị trí thì HOLD; tọa độ sai trả validation error; chi tiết tại mục 12 |
| Triển khai | Docker Compose local là đích bàn giao MVP; chưa mua hay triển khai dịch vụ cloud |

Nếu chủ repo muốn sửa/xóa trực tiếp giao dịch, phải thống nhất lại mô hình kế toán trước khi triển khai. Chốt chuyển tiền nội bộ trong MVP để kiểm tra tính nguyên tử giữa hai tài khoản.

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
- Trạng thái chốt: pending_review, posted, rejected, reversed. Luồng chuyển trạng thái và mã lỗi chốt ở hợp đồng.
- Duyệt một lệnh đang hold phải kiểm tra lại số dư, trạng thái tài khoản và quyền tại lúc ghi sổ. Không ghi sổ hai lần.

### 3.4 Phát hiện và xử lý gian lận

| Rule ID | Điều kiện chốt | Test biên bắt buộc |
| --- | --- | --- |
| HIGH_AMOUNT | amount > 1.000.000.000 | đúng 1 tỷ không match, 1 tỷ + 1 match |
| DISTANT_LOCATIONS | Khoảng cách hai giao dịch liên tiếp cùng tài khoản > ngưỡng km | dưới/bằng/trên ngưỡng; cùng vị trí; thiếu vị trí; tọa độ sai |
| RAPID_LARGE_TRANSACTIONS | Có giao dịch trước > 500 triệu và lệnh hiện tại > 500 triệu trong khoảng chênh lệch 30 giây | đúng 500 triệu không match; 500 triệu + 1; 29,999s/30s/30,001s |

Ngữ nghĩa chốt: dùng thời gian nhận tại server UTC, cửa sổ thời gian chênh lệch tuyệt đối <=30s giữa các candidate đã serialize; xem refinement tại backend/design/technical-design.md để xử lý received_at đảo thứ tự; so với các lệnh hợp lệ đã được chấp nhận trước đó (posted hoặc pending_review), loại lệnh rejected, validation failure và retry trùng key. Luật khoảng cách so với lệnh hợp lệ liền trước theo thứ tự xử lý được serialize; luật tốc độ tìm mọi lệnh lớn phù hợp trong cửa sổ, không chỉ giao dịch liền trước. Một lệnh có thể match nhiều luật, không nhân đôi bút toán.

Chuyển tiền đánh giá tài khoản nguồn là bên khởi tạo; khoản credit nhận tiền không được tính như một thao tác có mặt tại địa điểm của người nhận. Gửi/rút tại quầy dùng vị trí chi nhánh do server tra cứu từ giao dịch viên; quy tắc áp dụng trên tài khoản khách hàng. Khi thiếu vị trí, không tự coi khoảng cách là 0 hoặc coi kiểm tra đã đạt; hold với lý do riêng LOCATION_UNAVAILABLE. Trình bày khả năng false positive và cho phép cấu hình ngưỡng có phiên bản/audit.

Màn hình kiểm duyệt: danh sách cảnh báo, rule khớp và bằng chứng (amount, timestamps, distance), giao dịch liên quan, duyệt/từ chối có lý do, lọc trạng thái và người xử lý. Người tạo lệnh không tự duyệt lệnh của mình theo chính sách phân tách nhiệm vụ.

## 4. Các bất biến bắt buộc

1. Không dùng số thực cho tiền; ledger và số dư không sai khác sau lỗi hoặc retry.
2. Không overdraft do hai lệnh rút đồng thời. Khóa và transaction DB bảo vệ kiểm tra số dư lẫn ghi sổ.
3. Chuyển nội bộ hoặc hoàn tất cả hai phía hoặc không thay đổi phía nào; tổng debit/credit cân bằng theo mô hình ledger được duyệt.
4. Các lệnh cùng tài khoản được đánh giá gian lận nhất quán khi đến đồng thời; thứ tự khóa tránh deadlock cho chuyển khoản.
5. HOLD không làm tăng/giảm số dư đã ghi sổ; reserve theo mục 12, phải kiểm thử và hiển thị rõ.
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

Frontend sinh types bằng openapi-typescript, gọi qua openapi-fetch và dùng MSW làm HTTP mock adapter. Components gọi một API client duy nhất; không chứa điều kiện mock trong UI. Mock ở tầng HTTP, có store có trạng thái và fixtures giả lập, mô phỏng success, validation, unauthorized, forbidden, not-found, insufficient-funds, conflict, hold, timeout. Không gọi backend để chạy chế độ mock.

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

Theo ECC: TDD cho thay đổi hành vi; self-review diff; sửa lỗi do thay đổi; báo kết quả thực tế. Chốt coverage >= 80% cho module core nghiệp vụ, bổ sung case ledger/concurrency bắt buộc; coverage cao không thay thế kiểm thử bất biến. Cấu hình threshold ở bước 3.

CD chưa tự động production. Khi có môi trường được duyệt: build artifact có version, deploy staging, migrate có kiểm soát, smoke test, approve release và có rollback tương thích schema. Phân biệt local PASS, hosted CI PASS và target verification; không ghi success cho bước chưa chạy.

## 10. Rủi ro và cách giảm

- False positives: ngưỡng cấu hình, evidence, workflow review, phiên bản rule; không gọi cảnh báo là gian lận chắc chắn.
- Mất tiền/double-spend: ledger bất biến, DB transaction/locks, idempotency và concurrency integration tests.
- Thiếu/tamper vị trí: lưu provenance, validation, trạng thái chưa xác minh và chính sách hold được duyệt.
- Contract drift: canonical OpenAPI, generation và contract CI hai phía.
- Context giữa agents: đọc context và commit thực tế; ownership/worktrees; cập nhật handoff từng checkpoint.
- Quy trình bị chạy quá bước: yêu cầu approval explicit trong AGENTS và handoff; mỗi bước có commit riêng.

## 11. Checkpoint chủ repo kiểm tra

- [x] Chốt demo, customer/account CRUD, gửi/rút/chuyển nội bộ theo ủy quyền.
- [x] Chốt ledger bất biến và đảo giao dịch thay sửa/xóa bút toán.
- [x] Chốt > 500 km, lịch sử lệnh và thiếu vị trí theo mục 12.
- [x] Chốt > 1 tỷ; mỗi lệnh > 500 triệu trong <= 30 giây, thời gian server.
- [x] Chốt HOLD/review, vai trò và reservation theo mục 12.
- [ ] Chủ repo kiểm tra bản kế hoạch đã chốt trước khi bắt đầu bước thiết kế.

Các lựa chọn được chốt theo ủy quyền trong chat; chưa coi đây là phê duyệt bắt đầu bước 2. Sau khi chủ repo cho tiếp tục, bước 2 chuyển chúng thành thiết kế và hợp đồng có thể kiểm chứng.


## 12. Tech stack và nghiệp vụ đã chốt

Các quyết định dưới đây thay các lựa chọn còn mở của bản kế hoạch đầu tiên. Đây là quyết định cho MVP theo yêu cầu chủ repo tự chốt; không phải tuyên bố đã triển khai hay đã kiểm thử tương thích dependencies.

### Frontend

| Hạng mục | Lựa chọn | Mục đích |
| --- | --- | --- |
| Kiến trúc | React SPA, TypeScript strict, Vite | Dashboard có đăng nhập, deploy static qua reverse proxy, backend độc lập |
| Runtime/package manager | Node.js 24 LTS, npm, package-lock.json | Một toolchain frontend; CI dùng npm ci |
| Routing | React Router, declarative routing | Trang nghiệp vụ và route guards; server vẫn kiểm tra quyền |
| UI | Tailwind CSS + shadcn/ui, Lucide icons | Design tokens, forms/dialog/table thống nhất, component source nằm trong repo |
| Dữ liệu server | TanStack Query | Cache, pagination, loading/error, invalidate sau mutation |
| State khác | React state/context; filter trong URL | Không thêm global store khi chưa cần; số dư chỉ lấy từ API |
| Forms | React Hook Form + Zod | Validation UX; backend vẫn là nguồn kiểm tra cuối |
| Hợp đồng | OpenAPI 3.1 + openapi-typescript + openapi-fetch | Sinh types/client từ cùng artifact; không viết tay payload trùng lặp |
| Mock | MSW browser và Node | Cùng HTTP handlers/scenarios cho dev và tests; store demo reset được |
| Unit/component | Vitest + React Testing Library + jsdom | Hành vi người dùng, lỗi và form states |
| E2E | Playwright Chromium + axe-core | Journeys tài chính và kiểm tra accessibility thiết yếu |
| Chất lượng | ESLint, Prettier, tsc strict | CI lint/type/test/build |

Giao diện tiếng Việt, hiển thị VND bằng Intl.NumberFormat và thời gian Asia/Ho_Chi_Minh; API UTC. Form giữ tiền dạng chuỗi, không chuyển qua Number để tính toán tiền; hiển thị dùng BigInt khi cần. Không optimistic-update số dư hay tự retry mutation tiền: retry người dùng phải giữ cùng idempotency key. Không lưu token trong localStorage. Tự động vô hiệu hóa MSW trong build release; CI chứng minh app thật không bị mock intercept.

Chọn SPA vì MVP gồm các màn hình nghiệp vụ có đăng nhập và một backend FastAPI riêng. Không có nhu cầu SEO/SSR trong phạm vi này. Dashboard tập trung bảng dữ liệu, số dư, trạng thái và bằng chứng gian lận; biểu đồ chỉ bổ sung khi có yêu cầu cụ thể.

### Backend và hạ tầng

Python 3.13; FastAPI + Pydantic 2; SQLAlchemy 2 synchronous + psycopg 3; Alembic migrations; PostgreSQL 17 Docker; uv và uv.lock để khóa Python dependencies. FastAPI handlers truy cập DB dùng def với transaction/session theo request; không chạy synchronous DB I/O trong async handler. Kiến trúc modular monolith, rule engine đồng bộ trong ranh giới transaction; MVP không cần Redis, Celery, Kafka hoặc microservices.

pytest + pytest-cov + HTTPX cho tests; Ruff lint/format; mypy cho type checks; PostgreSQL thật cho integration. Docker Compose chạy Postgres, backend và frontend static qua Nginx. Cùng origin `/api` qua proxy (Vite proxy khi dev, Nginx khi compose) để đơn giản session/CSRF. Database không public trong bản compose đầy đủ; volume riêng. Health/readiness tách biệt. GitHub Actions chạy CI; Docker Compose local là đích bàn giao, chưa bật CD cloud.

Chốt họ công nghệ/runtime; exact patch của packages và Docker digest được resolve một lần ở bootstrap, kiểm tra peer dependencies và security advisories rồi commit lockfiles. Không dùng canary/beta hoặc Docker latest; việc khóa patch là kiểm chứng cài đặt, không mở lại quyết định stack. Tài liệu bước 2 phải ghi version matrix; nếu có incompatibility thực tế, báo trước khi đổi stack.

### Auth và quyền

Session opaque do server tạo, lưu hash trong Postgres; cookie HttpOnly, SameSite=Lax, Secure khi HTTPS, hết hạn tuyệt đối 8 giờ, rotate khi login, revoke khi logout. Password hash Argon2id. Mutation cần CSRF token gắn session và kiểm tra Origin. Bản local HTTP chỉ dùng cookie không Secure trong chế độ development explicit. Không tự đăng ký tài khoản public; seed users giả cho demo. Đăng nhập giới hạn thử bằng DB-backed policy được cụ thể hóa ở thiết kế.

- customer: xem tài khoản/lịch sử của mình và tạo chuyển tiền nội bộ từ tài khoản mình; không tự gửi tiền giả hoặc tự duyệt cảnh báo.
- teller: CRUD khách hàng/tài khoản, gửi/rút tại chi nhánh được gán, xem dữ liệu nghiệp vụ cần thiết; không duyệt fraud hay đổi luật.
- fraud_analyst: xem cảnh báo/evidence và approve/reject; không tạo giao dịch tiền hay tự sửa số dư.
- admin: quản lý users, vai trò, chi nhánh và cấu hình rule; không mặc nhiên có quyền tạo/duyệt giao dịch. Mỗi user một role trong MVP.

Chặn tự duyệt bằng actor ID tại backend; quyền tối thiểu áp dụng cả API và truy vấn ownership. Seed ít nhất một user mỗi role và hai customer, với dữ liệu giả rõ ràng.

### Tiền, HOLD và quyết định fraud

- VND nguyên đồng; API digit string; PostgreSQL BIGINT với validation trần theo loại dữ liệu, phép cộng được kiểm tra overflow. Ledger double-entry, tài khoản clearing hệ thống cho gửi/rút; bút toán posted không sửa/xóa. Chuyển nội bộ có trong MVP.
- Giao dịch rút/chuyển hợp lệ phải đủ available balance trước khi đánh giá. Nếu HOLD, reserve đúng amount trên tài khoản nguồn; available = posted balance - active reservations. Deposit HOLD không credit/reserve, chỉ chờ duyệt. Approve tiêu thụ reservation và post nguyên tử; reject giải phóng reservation. Không tự hết hạn trong MVP; danh sách review hiển thị tuổi lệnh và thời gian giữ tiền.
- Analyst approve là override có lý do dựa trên snapshot evidence, không chạy lại rule để tự hold vô hạn. Vẫn kiểm tra account đang active, reservation, quyền và ledger. Nếu điều kiện ghi sổ không đạt, trả conflict, giữ pending và không mất reservation; analyst có thể reject để giải phóng.
- DISTANT_LOCATIONS dùng Haversine > 500 km, không xét thời gian vì yêu cầu là khoảng cách giữa hai giao dịch gần nhất. Lệnh hợp lệ đầu tiên có vị trí không match luật này. Gửi/rút dùng tọa độ chi nhánh từ server; chuyển dùng vị trí mô phỏng gửi từ UI với source=demo_client, được hiển thị rõ chưa xác minh.
- Thiếu tọa độ: HOLD LOCATION_UNAVAILABLE. Tọa độ ngoài phạm vi/không hữu hạn hoặc chỉ có một thành phần: validation error, không đưa vào candidate history. Nếu lệnh trước thiếu vị trí thì cũng HOLD do không đánh giá được cặp; không coi là 0 km.
- HIGH_AMOUNT > 1 tỷ; RAPID_LARGE_TRANSACTIONS mỗi lệnh > 500 triệu trong <= 30s. Thời gian received_at do server đóng dấu, ordering riêng được gán trong lock tài khoản để serialize. Không chấp nhận timestamp client làm căn cứ. Đồng thời/đảo thứ tự nhận và xử lý phải có test ở bước thiết kế/implementation.
- Lịch sử xét luật: lệnh accepted hợp lệ, kể cả pending; loại rejected ở thời điểm đánh giá, retry và reversal hệ thống. Không thay đổi kết quả fraud lịch sử khi analyst quyết định sau đó; lưu rule version và evidence. Reversal có quyền teller yêu cầu, analyst duyệt riêng, không đảo lần hai; nếu bên bị debit không đủ available balance thì từ chối reversal, không cho âm.
- Rule engine lỗi: rollback và trả lỗi dịch vụ; không post, không tạo reserve dở dang. Request retry cùng key an toàn. Một lệnh nhiều rule tạo một quyết định HOLD với danh sách lý do và evidence.

### Contract và tiêu chí hoàn tất

Canonical `contracts/openapi.yaml`; validate bằng Redocly CLI, types sinh bằng openapi-typescript, responses và examples validate theo schema trong tests backend. So sánh FastAPI OpenAPI theo operation/method/path/schema đã normalize, bỏ metadata không mang nghĩa; CI phải bắt field/enum/status drift. Spec tạo ở bước 2, không có artifact schema giả ở bước chốt kế hoạch.

Core money/fraud modules đạt line và branch coverage >= 80%, cộng toàn bộ invariant/concurrency scenarios bắt buộc. Mock store chỉ mô phỏng quan sát bên ngoài; backend integration tests mới chứng minh locking/ledger thật. Bước song song chỉ bắt đầu khi contract/examples được duyệt, fixtures seed chung và code generation đã chạy được.

### Tài liệu chính thức đã tham khảo

- [Vite](https://vite.dev/guide/): dev server và build tool cho frontend.
- [React Router](https://reactrouter.com/start/declarative/installation): declarative routing.
- [shadcn/ui](https://ui.shadcn.com/docs): UI components có source để tùy chỉnh.
- [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview): server-state fetching/cache.
- [MSW](https://mswjs.io/docs/): mock ở tầng HTTP cho browser và Node.
- [openapi-typescript](https://openapi-ts.dev/introduction): sinh TypeScript từ OpenAPI 3.1.

Các lựa chọn kiến trúc/nghiệp vụ là quyết định của dự án; tài liệu thư viện chứng minh khả năng của công cụ, không thay thế kiểm thử tương thích stack khi bootstrap.

Thiết kế backend theo yêu cầu mới được tập trung tại [backend/design](../backend/design/README.md), thay vị trí docs/ dự kiến ban đầu. Hợp đồng canonical vẫn ở contracts/openapi.yaml để frontend/backend dùng chung.

Checkpoint backend 2026-11-03: chủ repo yêu cầu triển khai code rồi kiểm thử từng chức năng và hệ thống. Backend đã có runtime Docker và 61 tests đạt; frontend lane còn pending, không coi roadmap cả sản phẩm đã hoàn tất. Xem [implementation report](../backend/implementation-report.md).
