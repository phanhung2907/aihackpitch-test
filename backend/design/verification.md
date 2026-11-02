# Kiểm chứng thiết kế và kế hoạch tích hợp

## Traceability

| Plan | Thiết kế | Kiểm chứng khi triển khai |
| --- | --- | --- |
| Auth/session/quyền | F01, F11 | Auth, CSRF, role và ownership tests |
| Customer/account CRUD | F02, F03 | Soft archive, states, stale version và race với money |
| Gửi/rút/chuyển | F04, F05, F06 | Balanced ledger, atomic rollback, concurrency, retry |
| Ba rule và thiếu vị trí | F07 | Amount/time/distance boundary và simultaneous/out-of-order |
| HOLD/review/reserve | F08 | Exactly-once decision, consumed/released reserves |
| Đảo giao dịch | F09 | Original immutable, opposite journal, thiếu tiền/duplicate |
| History/dashboard/audit | F10 | Pagination ổn định, aggregate scope, no PII leak |
| Docker/seed/release | F12 | Migrate, persistence, backup/restore, health, CI |
| Parallel mock/API | OpenAPI và examples | Validate types, schemas, mock và provider, shared journeys |

## Frontend và backend cùng một hợp đồng

`contracts/openapi.yaml` là canonical. `contracts/examples.json` là các payload mẫu có schema name; không có dữ liệu thật. `contracts/scenarios.json` mô tả input/expected behavior ngoài schema (thời gian, số dư, geo, role), dùng để xây fixtures và tests bước bootstrap.

Frontend sinh types bằng openapi-typescript và client openapi-fetch, MSW intercept HTTP theo cùng paths. Mocks có store theo scenario/reset, không có DB thật. Mock tiền vẫn string và status pending không được giả thành posted. Kiểm tra schema ở runtime trong tests, không chỉ TypeScript cast.

Backend dựng Pydantic models theo spec, extra=forbid và response envelope; FastAPI-generated spec normalize rồi compare operation/path/required/enum/status với canonical. Thêm negative examples để chứng minh drift bị phát hiện. Các DTO không tự expose ORM models. Chưa có provider code nên chưa thể xác nhận provider conformance.

Dùng chung scenarios để chạy journeys mock và API thật. Parallel lane frontend chỉ sửa frontend, lane backend chỉ sửa backend; contracts thay đổi được người tích hợp điều phối trước. Backend docs này không yêu cầu frontend phụ thuộc Python hay DB để chạy mocks.

## Quality gates cho bước implementation

1. Unit rules với clock injection, Haversine boundary có dữ liệu cố định; không dựa sleep wall clock.
2. Postgres 17 integration thật với hai sessions/workers và synchronization barriers: double withdrawal, duplicate key, reverse transfers, approve/reject race, archive/close/freeze vs money.
3. Mỗi fault injection giữa journal, entry, cache, audit, idempotency phải rollback mọi artifact.
4. SQL constraints tests chống journal imbalance, duplicate reversal, negative customer available, direct UPDATE/DELETE immutable tables bằng runtime role.
5. Contract validate, fixtures validate, generated types diff; frontend lint/type/component/build; backend Ruff/mypy/pytest.
6. Core money/fraud line và branch coverage >=80%, không bỏ các invariant tests dù coverage đã đủ.
7. E2E CRUD → deposit → withdrawal/transfer → hold → review → history và reversal; screenshot responsive, keyboard và axe checks.
8. Health, restart persistence, backup/restore vào DB cô lập rồi reconcile. Không `down -v` tự động.

## Phạm vi xác minh tại checkpoint thiết kế

Có thể xác minh: links, YAML/OpenAPI syntax/spec, refs local, payload examples theo JSON Schema, route/schema coverage, Mermaid parse/render, tên/shape/arrow conventions và rà soát nghiệp vụ theo plan.

Chưa thể xác minh: runtime correctness, DB locking thật, performance/coverage, generated frontend types, mock/provider parity, hosted CI và deploy. Đây là thiết kế; không đánh dấu các gates runtime là đã PASS.

Các ngưỡng mặc định đúng plan: 1 tỷ, 500 km, 500 triệu, 30 giây. Refinement được ghi rõ: rapid so chênh lệch received_at tuyệt đối để chống lock-order đảo; transaction sequencing vẫn dưới khóa account. API endpoint details và error codes là quyết định thiết kế để owner kiểm tra trước bootstrap.


## Kết quả kiểm tra thiết kế — 2026-11-03

- PASS: openapi-spec-validator 0.7.2 xác minh 39 operations và 36 schemas trong OpenAPI 3.1.
- PASS: jsonschema xác minh sáu payload mẫu và loại các amount sai định dạng.
- PASS: 76 liên kết Markdown nội bộ; đủ 12 tài liệu chức năng và 30 scenario IDs.
- PASS: Mermaid CLI 11.12.0 render SVG và PNG preview bằng Chrome; đã xem preview và đơn giản hóa bố cục. Source .mmd khớp block Markdown; mọi arrow một chiều có nhãn.
- PASS: Git whitespace checks trước commit. ECC không được đưa vào Git.
- NOT PERFORMED: server/DB integration, frontend types/mocks runtime, E2E, coverage, hosted CI, deployment. Chưa có ứng dụng chạy trong checkpoint này.

Các công cụ kiểm tra/render chỉ cài trong thư mục tạm; không thêm runtime dependencies vào frontend/backend ở bước thiết kế.
