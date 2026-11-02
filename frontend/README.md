# Frontend — Banking UI

Giao diện cho nghiệp vụ ngân hàng: khách hàng, tài khoản, giao dịch gửi/rút/chuyển nội bộ và hàng đợi kiểm duyệt cảnh báo gian lận. Màn hình gọi thẳng API của backend trong repo này; không còn dữ liệu giả.

## Nguồn

- Nghiệp vụ và bất biến lấy từ [kế hoạch](../plans/banking-webapp-plan.md) (mục 3, 4, 12) và [thiết kế backend](../backend/design/README.md) trong cùng repo.
- Kiểu dữ liệu bám theo [hợp đồng canonical](../contracts/openapi.yaml); types trong `src/features/banking/data/types.ts` viết tay theo hợp đồng, chưa sinh bằng openapi-typescript.
- Nền UI là [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin), MIT, upstream `e16c87f`. Giữ `LICENSE` và [README.upstream.md](README.upstream.md).

## Màn hình

| Route | Nội dung |
| --- | --- |
| `/` | Tổng quan: số dư đã ghi sổ, tiền đang giữ, số cảnh báo chờ, biểu đồ giá trị theo tháng, cảnh báo đang chờ, giao dịch gần đây |
| `/customers` | Khách hàng, lọc theo trạng thái, đếm số tài khoản |
| `/accounts` | Tài khoản: số dư đã ghi sổ, phần đang giữ, số dư khả dụng, trạng thái |
| `/transactions` | Lịch sử giao dịch, lọc theo loại và trạng thái, dialog tạo lệnh gửi/rút/chuyển |
| `/fraud-alerts` | Hàng đợi kiểm duyệt; mở panel xem bằng chứng từng luật rồi duyệt hoặc từ chối kèm lý do |
| `/users`, `/settings`, `/errors/*` | Màn hình quản trị và lỗi giữ từ template |

## Quy ước nghiệp vụ đã tuân theo

- Tiền là chuỗi chữ số, định dạng bằng `Intl.NumberFormat` với `BigInt`; không giá trị tiền nào đi qua `Number`.
- `available_balance = posted_balance - reserved_amount`; giữ tiền không làm đổi số dư đã ghi sổ.
- Thời gian API là UTC, màn hình hiển thị theo `Asia/Ho_Chi_Minh`.
- Bốn mã lý do giữ: `HIGH_AMOUNT`, `DISTANT_LOCATIONS`, `RAPID_LARGE_TRANSACTIONS`, `LOCATION_UNAVAILABLE`.
- Lý do kiểm duyệt bắt buộc 10–1000 ký tự; màn hình ghi rõ người tạo lệnh không tự duyệt lệnh của mình.
- Vị trí chuyển khoản hiển thị rõ là dữ liệu mô phỏng chưa xác minh.

Quyết định gian lận, ghi sổ và số dư thuộc về backend. Màn hình này chỉ hiển thị và dựng payload.

## Chạy

Backend phải chạy trước, xem [hướng dẫn backend](../backend/README.md):

```
python backend/scripts/configure_local.py
docker compose -p banking-demo --profile app up -d --build --wait backend
docker compose -p banking-demo --profile app run --rm migrate python -m banking.manage seed
```

Thêm `http://localhost:5173` vào `ALLOWED_ORIGINS` trong `.env` ở repo root, rồi:

```
npm install
npm run dev
npm run build
npm run lint
```

Vite proxy `/api` sang `http://localhost:8000` nên trình duyệt coi API là same-origin: cookie phiên `bank_session` (HttpOnly) được gửi tự động và header `Origin` vẫn là origin của app, đúng thứ backend kiểm tra ở các lệnh ghi. Đổi đích bằng biến `VITE_API_TARGET`.

Đăng nhập bằng user seed: `admin`, `teller`, `analyst`, `alice`, `bob`. Mật khẩu là `DEMO_PASSWORD` trong `.env` ở repo root.

## Nối API

- `src/lib/api.ts` là HTTP client duy nhất: dựng URL `/api/v1`, gắn `X-CSRF-Token` và `Idempotency-Key` cho lệnh ghi, bóc vỏ `{data, meta}` và ném `ApiError` mang `status` + `code`.
- `src/features/banking/data/queries.ts` chứa toàn bộ hook TanStack Query theo từng operation của hợp đồng. Sau mỗi lệnh tiền, các query về giao dịch, tài khoản, cảnh báo và tổng quan đều bị invalidate.
- `src/stores/auth-store.ts` giữ user và CSRF token trong bộ nhớ; phiên nằm ở cookie HttpOnly nên không có credential nào trong localStorage.
- `src/routes/_authenticated/route.tsx` gọi `GET /auth/session` trước khi vào app và chuyển về `/sign-in` khi 401. Phân quyền thật do backend quyết; guard này chỉ chọn hiển thị app hay trang đăng nhập.
- Mỗi lệnh tiền và mỗi quyết định kiểm duyệt mang một `Idempotency-Key` sinh theo nội dung lệnh, nên gửi lại đúng payload cũ là retry, còn sửa nội dung là lệnh mới.
- Chưa dùng cursor phân trang: màn hình hiển thị trang đầu mà API trả về.

## Trạng thái kiểm chứng

`npx tsc -b`, `npm run build` và `npm run lint` pass. Backend đã chạy thật và kiểm bằng HTTP: đăng nhập `analyst` trả 200 kèm csrf_token, `GET /api/v1/fraud-alerts` trả mảng rỗng khi mới seed, và một lệnh gửi tiền `1000000001` bị giữ với `fraud_reason_codes: ["HIGH_AMOUNT"]`. Proxy `/api` qua Vite trả 200 cho `/api/v1/health/live`.

Chưa kiểm được: luồng đăng nhập và hiển thị dữ liệu trong trình duyệt, vì thao tác nhập mật khẩu demo nằm ngoài phạm vi tự động hóa ở đây. Unit test cũng chưa chạy (runner ở browser mode cần tải Playwright Chromium).
