# Latest handoff

Updated: 2026-11-03 (Asia/Bangkok).

## Completed checkpoint — backend implementation and testing

Owner authorized implementation, feature testing, then backend system testing. Backend is now runnable in Docker: [run instructions](../backend/README.md), [implementation report](../backend/implementation-report.md).

Implemented 41 canonical API operations, auth/roles/CRUD, money/ledger/reservations/idempotency, fraud rules/review/reversal, history/dashboard/admin, Alembic 001–004 and CI gates. Local full suite: 61 passing tests; total coverage 90.29%, domain lines/branches 100%, money lines 93.4% and branches 81.2%. Runtime role cannot rewrite ledger/balances/command amount. Docker HTTP smoke and isolated backup/restore passed. Frontend is still pending.

TDD RED checkpoint is 1b595fb. Contract gained missing PATCH users/branches, listBranches spelling normalized, same-origin server URL. Frontend must use the current spec, not the old 39-operation design snapshot. Runtime validates canonical JSON Schema directly, not handwritten Pydantic DTOs or a separate generated spec. Details/tradeoffs recorded in implementation report.

## Obsidian vault

The repository root is the Obsidian vault (`Open folder as vault`). Shared settings tracked in Git: `.obsidian/app.json` (relative Markdown links, `attachments/` for pasted files), `.obsidian/core-plugins.json` (explorer, search, switcher, graph, backlinks, outgoing links, page preview, templates, outline, command palette, canvas, properties, bookmarks, bases) and `.obsidian/templates.json` (`context/templates`, `YYYY-MM-DD`). Obsidian rewrote `core-plugins.json` into its current object format; keep that format so opening the vault does not dirty the tree. Workspace layout, appearance, hotkeys, caches and community plugins stay ignored per `.gitignore`.

## UI template shortlist for the competition

[Ten shortlisted UI templates](../plans/ui-templates-shortlist.md) are recorded for the AI HackPitch session on 2026-11-04, ranked by fit with the fixed React + Vite + Tailwind + shadcn/ui stack in plan section 12. Star counts, licenses and last-push dates come from the GitHub API on 2026-11-03. Nothing has been installed, cloned or built; the note also flags that pre-built templates may conflict with contest rules on code written during the event.

## Knowledge graph of the notes

`graphify-out/` holds a generated knowledge graph of the 11 Markdown files in this repository: 73 nodes, 124 edges and 8 labelled communities, with `graph.html`, `graph.json` and `GRAPH_REPORT.md`. The folder is ignored by Git because it contains machine-specific interpreter paths and an extraction cache; regenerate it with the graphify skill rather than sharing it. The health check reported three collapsed undirected edges (duplicate endpoint pairs), so edge counts are approximate. Extraction was LLM-based, so the graph is a navigation aid, not an authoritative index of the plan. This earlier graph predates the backend design and contracts; regenerate it to include the new artifacts.

## Banking UI branch

Branch `codex/banking-ui` (cut from `main` at the backend implementation commit) replaces the orientation README in `frontend/` with a working banking UI: dashboard, customers, accounts, transactions with a create-order dialog, and the fraud review queue with per-rule evidence and a mandatory decision reason. Screens read static fixtures shaped by the canonical contract; no API call, no MSW. See [the frontend readme](../frontend/README.md). `main` is untouched by this branch.

## Frontend is wired to the backend

The screens in `frontend/` now call the real API instead of fixtures: one HTTP client in `src/lib/api.ts`, TanStack Query hooks per contract operation in `src/features/banking/data/queries.ts`, a session guard on `/_authenticated`, and real login against `POST /api/v1/auth/login`. Vite proxies `/api` to `http://localhost:8000` so the HttpOnly session cookie and the Origin check both work. Running it needs the backend up and `http://localhost:5173` in `ALLOWED_ORIGINS`; see [the frontend readme](../frontend/README.md).

## Verification

Local unit/feature/contract/system suite, Ruff/format/mypy, runtime dependency audit, Docker startup/health, HTTP HOLD/reject/history and isolated restore reconciliation passed. Check implementation report for exact counts and commands. Hosted CI is separate; verify the actual GitHub run after publication. Demo config/credentials, .venv, coverage output and backup dumps stay ignored.

## Next action

STOP for owner review of backend. Do not begin frontend automatically. Backend Docker API is at http://localhost:8000/docs while the local stack runs. After review, implement frontend against generated OpenAPI types and MSW, then browser E2E/integration. Production is not deployed. Preserve concurrent UI shortlist/Obsidian/graph notes and local-only ECC.
