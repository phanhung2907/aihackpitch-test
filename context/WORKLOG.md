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
