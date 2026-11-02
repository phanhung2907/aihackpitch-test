# Mô hình dữ liệu PostgreSQL

Thiết kế logic; migrations chạy được nằm trong backend/migrations (001–004). UUID primary keys; timestamps timestamptz; money BIGINT; amounts trong command >0. FK mặc định RESTRICT; không cascade-delete dữ liệu tài chính. Tên dưới đây là tên chuẩn dùng trong code/contract mapping.

| Bảng | Trường chính và ràng buộc |
| --- | --- |
| users | id, login unique normalized, password_hash, role enum, customer_id nullable unique, branch_id nullable, enabled, version; role customer phải có customer_id; teller phải có branch_id |
| sessions | id, token_hash unique, user_id FK, created_at, expires_at, revoked_at; CSRF được derive HMAC theo session ID và APP_SECRET để GET session tái tạo, không lưu plaintext/hash CSRF trong bảng |
| login_throttles | key_hash PK (login+IP), window_started_at, failure_count, blocked_until; atomic increments |
| branches | id, code unique, name, latitude, longitude, active, version; valid paired coordinates |
| customers | id, full_name, email normalized unique, phone, status active/archived, version, created_at |
| accounts | id, number unique, kind customer/clearing, customer_id nullable FK, currency VND, label, status active/frozen/closed, posted_balance, reserved_amount, next_sequence, version; customer CHECK posted>=reserved>=0; clearing reserved=0 |
| transactions | id, type deposit/withdrawal/transfer, source_account_id nullable, destination_account_id nullable, initiated_account_id FK, actor_id FK, branch_id nullable, amount, status, received_at, account_sequence, location_source, latitude/longitude nullable, posted_at nullable, version; amount>0; unique(initiated_account_id,account_sequence) |
| rule_versions | id, version unique, high_amount_vnd, distance_km, rapid_amount_vnd, rapid_seconds, created_by, created_at; rows immutable |
| rule_configuration | singleton id=1, active_version_id FK, version; update pointer atomically; rules never disabled in MVP |
| fraud_evaluations | id, transaction_id unique FK, rule_version_id FK, outcome allow/hold, evaluated_at, results JSONB array; includes matched, unavailable, skipped, evidence snapshots of candidate IDs/times/amounts/sequence/distance/provenance |
| fraud_alerts | id, transaction_id unique FK, status open/approved/rejected, created_at, resolved_at nullable; evidence from evaluation, not duplicated editable fields |
| reservations | id, transaction_id unique FK, account_id FK, amount>0, state active/consumed/released, created_at, resolved_at nullable |
| journals | id, transaction_id unique nullable FK, reversal_request_id unique nullable FK, original_journal_id nullable unique FK, posted_at; XOR transaction/reversal association |
| ledger_entries | id, journal_id FK, account_id FK, delta !=0; unique(journal_id,account_id); balance values checked before cast BIGINT |
| review_actions | id, transaction_id FK, analyst_id FK, decision approve/reject, reason 10..1000 chars, created_at; unique(transaction_id), since only final decision persisted |
| reversal_requests | id, original_transaction_id FK, requested_by FK, reason, status pending_review/posted/rejected, analyst_id nullable FK, review_reason nullable, created_at; partial unique original_transaction_id where status in pending_review,posted |
| idempotency_records | id, actor_id FK, key string 16..128, request_hash, method, path, resource_type, resource_id, original_status; unique(actor_id,key), row committed only with success |
| audit_logs | id, actor_id nullable, action, resource_type, resource_id, request_id, timestamp, before/after restricted JSONB; immutable, no secret or excessive PII |

## Quan hệ dễ hiểu

Một khách hàng có nhiều tài khoản; một user customer ánh xạ tối đa một khách hàng. Một lệnh có thể tác động hai tài khoản nhưng chỉ có một tài khoản khởi tạo để xét fraud. Một lệnh có một evaluation, tối đa một cảnh báo và tối đa một reserve. Khi ghi sổ, một lệnh có một journal và tối thiểu hai entries. Một journal có thể được đảo tối đa một lần bằng journal mới. Giữ journal gốc và transaction gốc để tra cứu xuyên suốt.

## Constraint chi tiết

- Deposit: source null, destination customer active; initiated=destination. Withdrawal: source customer active, destination null; initiated=source. Transfer: hai account customer khác nhau, initiated=source. Clearing account được service chọn, không nhận từ browser.
- posted_at không null khi posted/reversed, null khi pending/rejected. Lat/lon đều null hoặc đều hợp lệ trong [-90,90],[-180,180]; source branch/demo_client/unavailable không do client được nâng thành branch.
- Với journal gốc, tổng delta bằng 0; có đúng hai entries cho MVP và amount khớp command. Trigger deferred đảm bảo không commit journal rỗng hoặc imbalance. Không thể post nếu reserve không nhất quán.
- Review actor khác initiator; enforce trong service và DB trigger cross-row. Role recheck trong transaction.
- Cache balance/reserved không do PATCH account nhận; request schema cấm chúng. Việc sửa label không tăng/giảm số dư.
- Account và customer version dùng optimistic concurrency cho PATCH; request expected_version, version mismatch trả 409 STALE_VERSION.
- Không JSONB làm nguồn thay thế cho money/status chính: evidence là snapshot, command/ledger mới là dữ liệu hoạt động.

## Index theo query

transactions(initiated_account_id,account_sequence DESC) cho cặp địa điểm; transactions(initiated_account_id,received_at,amount) cho cửa sổ rapid; index partial status IN posted,pending_review. transactions(source_account_id,created_at DESC,id), transactions(destination_account_id,created_at DESC,id) cho history (thêm created_at vào commands). fraud_alerts(status,created_at,id); reservations(account_id) WHERE state=active; sessions(token_hash) unique và sessions(user_id,revoked_at); ledger_entries(account_id,journal_id); audit_logs(resource_type,resource_id,timestamp,id). Customer search email index, name search đơn giản trước khi đo nhu cầu trigram.

## Dữ liệu seed, migration và retention

Seed idempotent: một chi nhánh Hà Nội, một TP.HCM, admin/teller/analyst và hai customers với stable UUIDs; password demo lấy env local, không commit. Opening funds qua deposit/clearing journal có audit (seed system actor và bypass fraud explicit chỉ trong seed profile), không UPDATE balance thủ công. Seed cảnh báo bằng HTTP/domain scenarios, không chèn ledger sai constraint.

Alembic tạo schema và constraints theo migration có version; một migration runner, không mỗi worker. Backup trước migration có dữ liệu. Expand/contract cho thay đổi tương lai; rollback app không dùng downgrade phá ledger. Demo không auto-purge journal/evidence/idempotency. Retention dữ liệu thật cần yêu cầu riêng, chưa có legal policy trong MVP.
