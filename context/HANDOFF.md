# Latest handoff

Updated: 2026-11-03 (Asia/Bangkok).

## Completed checkpoint — backend design

Owner authorized overall backend design, feature designs and one consistent beginner-friendly Mermaid product flow. See [backend design index](../backend/design/README.md), [product flow](../backend/design/product-flow.md) and [API contract](../contracts/README.md).

Delivered system/technical/data designs, 12 feature documents, Mermaid source + SVG, 39 OpenAPI operations/36 schemas, six examples and 30 acceptance scenarios. No application, migration, frontend generation or hosted CI has run.

Important refinement: rapid fraud uses absolute server-received time difference <=30s among serialized candidates, so lock-order inversion cannot miss the pair. Immutable signed-delta double-entry journals and debit-only reservations are described in technical design. Plan locations reconciled to backend/design instead of the initial docs/ proposal.

## Obsidian vault

The repository root is the Obsidian vault (`Open folder as vault`). Shared settings tracked in Git: `.obsidian/app.json` (relative Markdown links, `attachments/` for pasted files), `.obsidian/core-plugins.json` (explorer, search, switcher, graph, backlinks, outgoing links, page preview, templates, outline, command palette, canvas, properties, bookmarks, bases) and `.obsidian/templates.json` (`context/templates`, `YYYY-MM-DD`). Obsidian rewrote `core-plugins.json` into its current object format; keep that format so opening the vault does not dirty the tree. Workspace layout, appearance, hotkeys, caches and community plugins stay ignored per `.gitignore`.

## UI template shortlist for the competition

[Ten shortlisted UI templates](../plans/ui-templates-shortlist.md) are recorded for the AI HackPitch session on 2026-11-04, ranked by fit with the fixed React + Vite + Tailwind + shadcn/ui stack in plan section 12. Star counts, licenses and last-push dates come from the GitHub API on 2026-11-03. Nothing has been installed, cloned or built; the note also flags that pre-built templates may conflict with contest rules on code written during the event.

## Knowledge graph of the notes

`graphify-out/` holds a generated knowledge graph of the 11 Markdown files in this repository: 73 nodes, 124 edges and 8 labelled communities, with `graph.html`, `graph.json` and `GRAPH_REPORT.md`. The folder is ignored by Git because it contains machine-specific interpreter paths and an extraction cache; regenerate it with the graphify skill rather than sharing it. The health check reported three collapsed undirected edges (duplicate endpoint pairs), so edge counts are approximate. Extraction was LLM-based, so the graph is a navigation aid, not an authoritative index of the plan. This earlier graph predates the backend design and contracts; regenerate it to include the new artifacts.

## Verification

OpenAPI spec and six example schema validations pass. Mermaid rendered to SVG/PNG and visually reviewed, then simplified for readability. Local links, Mermaid source/embedded block synchronization, and whitespace are checked at closeout. Runtime scenarios are future acceptance criteria, not executed tests.

## Next action

STOP for owner review before bootstrap or implementation. After design/contract approval, follow plan step 3, lock compatible package patches and establish runtime/CI commands. Frontend/backend then share the canonical contract and mock scenarios. ECC remains local-only and ignored by Git.
