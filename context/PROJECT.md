# Project facts

Last updated: 2026-11-03 (Asia/Bangkok).

## Confirmed scope

The owner wants a banking webapp with customer/account CRUD, deposits, withdrawals, and fraud detection. Required backend: Python/FastAPI; database: PostgreSQL in Docker. Keep `frontend/` and `backend/` separate. Plan shared API contracts and mock data so frontend and backend can develop in parallel and integrate later. Fraud scenarios: amount above VND 1 billion; consecutive transactions at distant locations; two transactions each above VND 500 million within 30 seconds. Distance >500 km and HOLD/review are now decided; detailed tech and business policies are in section 12 of the plan. Frontend: React/TypeScript/Vite, Tailwind/shadcn, React Router, TanStack Query, MSW and generated OpenAPI types. Finish, commit/push, and stop for owner review after each step. Owner authorized backend design. System/technical/data and 12 feature designs are in backend/design; shared OpenAPI is in contracts/openapi.yaml. Backend is now implemented/tested (61 passing tests, 90.29% coverage); frontend remains pending owner review.

## Repository

- Name: `aihackpitch-test`
- GitHub: [phanhung2907/aihackpitch-test](https://github.com/phanhung2907/aihackpitch-test)
- Expected remote: `origin` -> `https://github.com/phanhung2907/aihackpitch-test.git`
- Initial working branch: `main`
- Initial inspection: no local commits or application files existed.

## Environment and tools

- Setup machine: Windows, PowerShell; working folder `E:\aihackpitch-test`.
- Time zone for handoff dates: Asia/Bangkok.
- 314 ECC skills are installed locally in `.agents/skills/` and the owner's personal skill directory. ECC installation files are ignored by Git and are not published; other machines need their own installation.
- Personal ECC workflow is in `C:\Users\HungPhan\.codex\AGENTS.md`; portable repo behavior is in [the root agent instructions](../AGENTS.md).
- Vault location: repository root. No community plugins are needed.

## Verification and deployment

Backend runs with Docker/PostgreSQL and uv/pytest; 61 local tests pass and the GitHub Actions backend workflow is configured. Verify hosted CI independently. Local Docker is the current target; no frontend or production deployment yet.
