# Frontend

Ứng dụng web sẽ được triển khai trong thư mục này sau khi kế hoạch và hợp đồng API được duyệt. Frontend phát triển bằng HTTP mocks và types sinh từ hợp đồng chung, rồi chuyển sang API thật bằng cấu hình.

Xem [kế hoạch chi tiết](../plans/banking-webapp-plan.md). Chưa bootstrap framework hoặc cài dependency ở bước kế hoạch.

Stack đã chốt: React SPA + TypeScript strict + Vite; Tailwind CSS + shadcn/ui; React Router; TanStack Query; React Hook Form + Zod; openapi-typescript/openapi-fetch; MSW; Vitest/Testing Library và Playwright. Node.js 24 LTS, npm, lockfile. Chi tiết và lý do trong mục 12 của kế hoạch.
