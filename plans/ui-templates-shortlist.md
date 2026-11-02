# Shortlist 10 UI template cho AI HackPitch

Cập nhật: 2026-11-03 (Asia/Bangkok). Dùng cho buổi thi ngày 2026-11-04.

Mục tiêu: có sẵn một nền UI chạy được ngay để demo banking webapp (dashboard có đăng nhập, bảng giao dịch, cảnh báo gian lận) thay vì dựng layout từ đầu trong lúc thi.

Tiêu chí chọn: ưu tiên React + Vite + Tailwind + shadcn/ui để khớp [stack đã chốt ở mục 12 của kế hoạch](banking-webapp-plan.md); giấy phép cho phép dùng lại (MIT hoặc Apache-2.0); repo còn được cập nhật.

Số sao, giấy phép và lần đẩy code cuối lấy từ GitHub API ngày 2026-11-03. Số sao thay đổi theo thời gian; giấy phép phải đọc lại file `LICENSE` trong repo trước khi dùng.

## Nhóm A — khớp stack đã chốt (React + Vite + shadcn/ui)

| # | Template | Số sao | Giấy phép | Đẩy code cuối | Vì sao chọn |
| --- | --- | --- | --- | --- | --- |
| 1 | [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin) | 16.361 | MIT | 2026-09-10 | Admin dashboard dựng bằng shadcn/ui + Vite. Khớp stack nhất và phổ biến nhất trong danh sách. Lấy làm nền chính. |
| 2 | [TailAdmin/free-react-tailwind-admin-dashboard](https://github.com/TailAdmin/free-react-tailwind-admin-dashboard) | 1.293 | MIT | 2026-10-29 | React 19 + Tailwind v4, có sidebar, biểu đồ, bảng, dark mode. Phương án hai nếu bản trên quá tối giản. |
| 3 | [shadcn/ui blocks — `dashboard-01`](https://ui.shadcn.com/blocks/dashboard) | 127.183 (repo `shadcn-ui/ui`) | MIT | 2026-11-02 | Block chính thức: sidebar + biểu đồ + data table, thêm bằng `npx shadcn@latest add dashboard-01`. Không phải template rời nên không lệch phiên bản component. |
| 4 | [sadmann7/tablecn](https://github.com/sadmann7/tablecn) | 6.369 | MIT | 2026-11-02 | Data table shadcn có sort, filter, phân trang, chọn dòng. Dùng cho trang danh sách giao dịch và danh sách cảnh báo chờ duyệt. |
| 5 | [salimi-my/shadcn-ui-sidebar](https://github.com/salimi-my/shadcn-ui-sidebar) | 1.797 | MIT | 2025-04-04 | Sidebar thu gọn được, chỉ lấy phần layout. Viết cho Next.js nhưng component gần như thuần React nên port sang Vite dễ. |

## Nhóm B — Next.js, UI đẹp hơn nhưng lệch stack

Dùng khi chỉ cần demo nhìn thuyết phục trong một ngày và chấp nhận không tái sử dụng trực tiếp cho `frontend/` về sau.

| # | Template | Số sao | Giấy phép | Đẩy code cuối | Vì sao chọn |
| --- | --- | --- | --- | --- | --- |
| 6 | [Kiranism/next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter) | 7.218 | MIT | 2026-11-01 | Next.js 16 + shadcn/ui, còn cập nhật rất sát ngày thi. Nhiều trang mẫu sẵn. |
| 7 | [arhamkhnz/next-shadcn-admin-dashboard](https://github.com/arhamkhnz/next-shadcn-admin-dashboard) | 3.242 | MIT | 2026-10-30 | Next.js 16 + shadcn/ui, nhiều biến thể dashboard để chọn nhanh. |
| 8 | [abderrahimghazali/shadcn-fintech](https://github.com/abderrahimghazali/shadcn-fintech) | 101 | MIT | 2026-10-24 | Gần nghiệp vụ nhất: các trang accounts, transactions, cards. Ít sao nên cần đọc code trước khi tin. |

## Nhóm C — thư viện biểu đồ và KPI

| # | Template | Số sao | Giấy phép | Đẩy code cuối | Vì sao chọn |
| --- | --- | --- | --- | --- | --- |
| 9 | [tremorlabs/tremor](https://github.com/tremorlabs/tremor) | 3.686 | Apache-2.0 | 2025-10-10 | Component biểu đồ và KPI card copy-paste, hợp cho thẻ số dư và biểu đồ giao dịch. |
| 10 | [tremorlabs/template-dashboard-oss](https://github.com/tremorlabs/template-dashboard-oss) | 518 | Apache-2.0 | 2025-10-10 | Dashboard hoàn chỉnh của Tremor, lấy làm tham khảo bố cục trang tổng quan. |

## Cách dùng trong ngày thi

1. Lấy `satnaing/shadcn-admin` làm nền (mục A1), vì đã là Vite + shadcn.
2. Thay dữ liệu mẫu bằng MSW handlers theo hợp đồng API, không gọi backend thật khi demo.
3. Ghép bảng giao dịch từ `tablecn` (A4) và thẻ KPI/biểu đồ từ Tremor (C9).
4. Nếu cần trang nghiệp vụ ngân hàng sẵn, tham khảo bố cục từ `shadcn-fintech` (B8) rồi viết lại bằng component của nền đã chọn.
5. Giao diện tiếng Việt, tiền VND bằng `Intl.NumberFormat`, thời gian Asia/Ho_Chi_Minh — theo mục 12 của kế hoạch.

## Lưu ý trước khi dùng

- MIT và Apache-2.0 đều yêu cầu giữ lại thông báo bản quyền của tác giả gốc. Giữ file `LICENSE` của template và ghi nguồn trong README nếu fork.
- Nếu quy chế cuộc thi yêu cầu code viết trong thời gian thi, template dựng sẵn có thể bị tính là chuẩn bị trước. Đọc quy chế trước khi mang vào bài thi.
- Chưa cài hay chạy thử template nào trong repo này. Bảng trên là kết quả tra GitHub API, không phải kết quả kiểm thử build.
- Số sao và tình trạng bảo trì của các repo ít sao (B8, A5) cần kiểm tra lại sát ngày dùng.
