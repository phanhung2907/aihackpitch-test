# Agent instructions

## Start every task

1. Read [the context index](context/README.md), [project facts](context/PROJECT.md), and [the latest handoff](context/HANDOFF.md). Read relevant entries in [the work log](context/WORKLOG.md).
2. Inspect Git status, the current branch, and the actual source/configuration before editing. Notes are a handoff, not proof that code or remote state is unchanged.
3. Preserve other agents' and the user's changes. If agents work concurrently, use separate worktrees/branches and task-specific notes; do not stage or commit another agent's work.
4. Use the locally installed ECC skills in `.agents/skills/` first. Read only skills relevant to the task: `git-workflow`, `tdd-workflow`, `verification-loop`, `security-review`, and `deployment-patterns` cover the core engineering workflow. ECC files are local-only and ignored by Git. On other machines, install ECC separately or follow this file's portable workflow. Adapt Claude-specific tool names and examples to the actual host; do not assume upstream repository scripts are installed.

## Current owner checkpoint policy

For the banking webapp project, finish one approved step, validate it, commit and push, then stop and report for the owner's review. Do not begin the next step until the owner approves. Frontend and backend implementation may proceed in parallel only after the detailed plan and shared API contract have been approved. Keep implementation in separate `frontend/` and `backend/` folders.

## Engineering workflow

- Understand acceptance criteria and plan substantial changes.
- Implement focused changes and meaningful regression tests for changed behavior.
- Use the project's real commands for the applicable lint, type, test, build, and security checks. For documentation/configuration-only work, validate the changed files and links; do not invent application tests.
- Review the final diff. Record the checks actually run, their results, and anything not verified.
- Never store credentials, access tokens, private customer data, or full chat transcripts in the vault.

## Required task closeout: update context, commit, push

The repository owner explicitly authorizes agents to commit and push their own completed task changes to the configured GitHub remote after every task. This is standing authorization; do not ask for confirmation each time. Execution-environment permission prompts may still be required.

1. Update `context/PROJECT.md` when durable facts change. Update `context/HANDOFF.md` with the current state, important files, verification, and the next actionable step. Append a concise dated entry to `context/WORKLOG.md`. Keep one source of truth and link to it rather than copying long notes.
2. Check `git status --short --branch` and `git diff --check`; review the changes and stage only explicit paths belonging to the completed task. Avoid `git add .` when unrelated work exists.
3. Commit code/configuration and its context updates together using a Conventional Commit message (`feat:`, `fix:`, `docs:`, `chore:`, or `ci:`). Do not create an empty commit when nothing changed.
4. Inspect the configured remote and current branch. This repo's expected remote is `origin`, `https://github.com/phanhung2907/aihackpitch-test.git`. If it changes unexpectedly, resolve the discrepancy before publishing.
5. Fetch `origin` and check for incoming commits before pushing. Preserve remote history; never force-push, reset away changes, skip hooks, or bypass branch protection. Reconcile concurrent changes and rerun affected checks before publishing. If conflicts, authentication, or protection prevent completion, preserve local work and report the precise blocker.
6. Push the current branch to its upstream (`git push`). For a new branch use `git push -u origin <current-branch>`. Use the existing `main` branch for this initial setup; if a new task needs isolation, create a `codex/` branch and push that branch. Do not automatically merge into protected branches.
7. Verify the pushed branch's remote commit equals the local task commit. Report the commit hash and branch, and distinguish local checks from hosted CI or deployed-environment checks. Do not claim success if push failed.

For discussion-only/read-only tasks, report that no repository changes were needed; no empty commit is required. If required checks fail, fix them or report the task as incomplete instead of publishing a false completion.

## Obsidian vault

The repository root is the Obsidian vault. Open this folder with **Open folder as vault**. Markdown remains readable by any agent without Obsidian. Use relative Markdown links so GitHub and Obsidian can both navigate the notes.

Track shared `.obsidian` settings only. Personal workspace layouts, caches, local plugin state, and secrets are ignored. Git is the shared synchronization mechanism; Obsidian Sync and third-party auto-commit plugins are not required.
