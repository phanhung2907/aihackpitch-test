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

The application stack and deployment target have not been chosen. Add application CI/CD when the project has real build/test commands and a deployment target. Agent commit/push instructions do not themselves constitute a hosted CI/CD pipeline.
