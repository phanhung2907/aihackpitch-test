# Project facts

Last updated: 2026-11-02 (Asia/Bangkok).

## Confirmed scope

The owner wants a banking webapp with customer/account CRUD, deposits, withdrawals, and fraud detection. Required backend: Python/FastAPI; database: PostgreSQL in Docker. Keep `frontend/` and `backend/` separate. Plan shared API contracts and mock data so frontend and backend can develop in parallel and integrate later. Fraud scenarios: amount above VND 1 billion; consecutive transactions at distant locations; two transactions each above VND 500 million within 30 seconds. Exact geographic thresholds and response policy await planning review. Finish, commit/push, and stop for owner review after each step. Detailed plan is now drafted in plans/banking-webapp-plan.md; awaiting owner review before system/API design.

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

No application build, test runner, hosted CI pipeline, or deployment target is configured yet. Validate Markdown links, JSON settings, and Git changes for this setup. Add appropriate CI/CD when the application stack is established.
