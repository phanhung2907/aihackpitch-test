# F07 — Phát hiện giao dịch đáng ngờ

## Trách nhiệm và giao diện

Module: **FraudService (pure rules + history repository)**. Endpoint dưới đây thêm prefix `/api/v1`; payload chuẩn trong [OpenAPI](../../../contracts/openapi.yaml). [Quy ước chung](../technical-design.md) áp dụng cho tất cả.

`Không có public endpoint để client tự gọi/ghi kết quả; GET /fraud-alerts dành analyst`

## Người dùng và quyền

TransactionService duy nhất cấp dữ liệu có thẩm quyền; analyst đọc snapshot evidence.

## Luồng xử lý

HIGH_AMOUNT: >1000000000. DISTANT_LOCATIONS: Haversine >500 km, earth radius 6371.0088 km, clamp công thức ở biên số học; không round trước compare. RAPID_LARGE_TRANSACTIONS: current và candidate mỗi amount>500000000, abs(received_at gap)<=30s, candidate đã serialize. Candidate posted/pending, loại rejected/reversed/retry/reversal. Rule results có matched/unavailable/skipped và version.

## Kết quả và trường hợp lỗi

ALLOW khi mọi rule khả dụng không match; HOLD khi có match hoặc LOCATION_UNAVAILABLE. Lệnh đầu có vị trí thì distance skipped=no_previous, không phải unavailable. Lệnh trước thiếu location làm current hold. Exception là 503 rollback, không phải ALLOW.

## Dữ liệu và transaction

Evaluation immutable snapshot gồm candidate IDs/sequence, tiền, thời gian, threshold, distance chưa làm tròn và provenance. Rule version pointer đọc atomic, không đọc threshold từ frontend.

## Tiêu chí nghiệm thu

FRD-01 1 tỷ/1 tỷ+1; FRD-02 500 triệu/500 triệu+1; FRD-03 29.999/30/30.001s; FRD-04 exactly500km; FRD-05 first/missing/invalid; FRD-06 out-of-order/concurrent; FRD-07 nhiều rule một alert.

Chưa có code chạy ở checkpoint thiết kế. Test IDs là yêu cầu triển khai, không phải test đã pass.
