# Work log

## 2026-11-02 — Shared context and task closeout setup

- Request: make context available to different agents through Obsidian and automatically commit/push after completed tasks.
- Added: repository agent rules, root vault settings, shared project facts, handoff, and task template.
- Verification: 16 local Markdown links resolve, 3 JSON files parse, and staged Git whitespace checks pass; staged changes reviewed. Application build/tests/deployment are not applicable because no application exists yet.
- Obsidian already exists on this machine; the UI remained on an existing vault's loading screen, so the new vault was not verified visually.
- Publication evidence: use Git history and the task's final response; commit hashes are not embedded in the same commit that creates this entry.

## 2026-11-02 — Repository-local ECC installation

- Installed all 314 ECC skills in `.agents/skills/` at upstream revision `b38be6a7f6350964d59328b52f0624e1d1d552d1`.
- Added upstream license, provenance, agent routing, banking requirements, and stop-for-review policy.
- Verified all 314 SKILL.md hashes against the pinned installation. Application tests do not apply.
- Next: await owner review before writing the detailed banking product plan.

## 2026-11-02 — Keep ECC local

- Owner requested local-only ECC. Added targeted ignore rules for the skill catalog, license, provenance, and local installation README.
- Removed ECC installation files from the Git index while preserving the local files. Updated agent/context guidance to describe local-only availability.
- Product planning remains pending owner review.

## 2026-11-02 — Banking product plan (step 1)

- Added detailed scope, fraud semantics and proposed decisions, money/ledger invariants, seven checkpoints, test/CI/CD matrix, and mock/contract strategy for parallel frontend/backend work.
- Added frontend/backend orientation READMEs; no runtime code or dependencies yet.
- Next: owner review, then separate technical/system/flow design step with Mermaid and OpenAPI.

## 2026-11-02 — Close planning decisions

- Owner delegated remaining planning choices. Fixed frontend/backend stack, contract/mock tooling, auth/roles, fraud thresholds/location policy, reservations and review semantics in plan section 12.
- Updated frontend/backend orientation notes and shared context. No runtime packages installed; implementation/technical design checkpoint remains pending.
- Verified documentation links, decision consistency and whitespace; runtime tests are not applicable to this documentation change.

## 2026-11-02 — Obsidian vault settings

- Committed Obsidian's own object format for `.obsidian/core-plugins.json` so opening the vault no longer leaves the tree dirty.
- Enabled the command palette core plugin; added `attachments/` with a short README to match `attachmentFolderPath`.
- Verified the shared settings files parse as JSON and that ignored personal state (workspace, appearance, hotkeys, plugins) stays untracked.
- Next: banking webapp step 2 still waits for owner review.

## 2026-11-03 — UI template shortlist for AI HackPitch

- Added `plans/ui-templates-shortlist.md`: ten candidate UI templates grouped by stack fit (React/Vite/shadcn, Next.js, chart libraries).
- Verified each repository's star count, SPDX license and last push through the GitHub API; two earlier candidates were dropped as 404 or unmaintained.
- No template was cloned, installed or built, so no build or test evidence exists for them. Flagged license attribution and contest-rule risk.
- Next: owner decides which template becomes the `frontend/` base; banking step 2 still waits for review.

