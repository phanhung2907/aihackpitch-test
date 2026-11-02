# aihackpitch-test

Shared project workspace with an Obsidian vault and persistent context for coding agents.

## Start here

- Agents: read [AGENTS.md](AGENTS.md), then the [context index](context/README.md).
- People: open this repository folder in Obsidian using **Open folder as vault**, or read the Markdown directly on GitHub.
- After a completed task, update the context notes, run the relevant checks, commit the task, and push to the current branch. The detailed workflow is in [AGENTS.md](AGENTS.md).

## Repository contents

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | Instructions and standing authorization for task commit/push |
| `context/PROJECT.md` | Confirmed project facts and environment |
| `context/HANDOFF.md` | Current state and continuation guide |
| `context/WORKLOG.md` | Concise completed-task history |
| `context/templates/TASK.md` | Reusable task handoff format |
| `.obsidian/` | Shared vault settings |

The banking stack is defined in the [product plan](plans/banking-webapp-plan.md). Read the [backend system and feature designs](backend/design/README.md), [A-to-Z product diagram](backend/design/product-flow.md) and [shared API contract](contracts/README.md). The [backend is implemented and runnable](backend/README.md), with PostgreSQL/Docker and unit, feature and system tests; see the [implementation report](backend/implementation-report.md). Frontend and production deployment are not implemented yet.

Reusable engineering notes: [Vietnamese webapp playbook](docs/playbook/README.md), covering planning, system/feature/flow design, Mermaid, frontend/backend, fast testing and handoff. See the playbook status note for work still awaiting integration acceptance.
