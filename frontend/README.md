# Frontend — Banking UI

Giao diện demo cho nghiệp vụ ngân hàng: khách hàng, tài khoản, giao dịch gửi/rút/chuyển nội bộ và hàng đợi kiểm duyệt cảnh báo gian lận. Toàn bộ dữ liệu là fixtures tĩnh; chưa gọi backend.

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

```
npm install
npm run dev
npm run build
npm run lint
```

## Trạng thái kiểm chứng

`npm run build` và `npm run lint` pass. Dev server render đúng các màn hình nghiệp vụ. Chưa chạy unit test vì runner chạy ở browser mode và cần tải Playwright Chromium. Chưa nối API thật, chưa có MSW.
