# Architecture decision and reconnaissance

## Observed starting point

The supplied repository contained one README and one initial commit. No Unity `Assets`, `Packages`, or `ProjectSettings`, prior GDD app, schema, assets, tests, or original research report were available. The uploaded addendum was treated as product evidence; its embedded directive to stop after a single phase did not override the user's explicit request to build through all phases. Existing files were preserved; the README was expanded into launch documentation.

Observed tools: Node 24.19.0, Python 3.12.14, Chromium, and Codex CLI 0.159.0-alpha.3. Codex login status reported authenticated. Live CLI and App Server initialization were attempted during integration smoke testing; both failed before a provider turn because their configured runtime home is read-only. `codex app-server --help` confirmed the experimental server transport and schema-generation commands; no live JSON-RPC compatibility handshake was established.

## Decisions

1. React + TypeScript renders a constrained registry of content and safe views. Three.js provides GLB preview. UI components never execute user-defined JavaScript.
2. Node's built-in SQLite eliminates a native dependency for the local API. A transaction saves the state aggregate and its previous checkpoint atomically. Entity IDs, registries, stage values, and dependency graphs are validated before saving.
3. SQLite currently owns writable workspace state. Markdown + JSON are generated readable projections, rather than two competing writable stores. Intentional promotion to project Git remains manual. This is a pragmatic first implementation; a future bidirectional canonical-file importer needs conflict reconciliation and migration tests.
4. Codex transport sits behind `server/integrations.js`. CLI read-only planning and scoped worktree implementation have different execution permissions. The App Server remains a candidate for future streaming and native approval transport; interfaces are not assumed equivalent.
5. Implementation uses clean-state checks, detached worktrees, exact relative file allowlists, captured Git patches, explicit application approval, and rechecked HEAD. It never claims test evidence from prose alone. A successful model exit does not mark a task verified.
6. Unity owns engine data. Discovery and the editor manifest helper preserve GUID identity and metadata. No speculative converter or batch execution is launched.
7. Snapshot migrations, merges, decision supersession, new workflows, and views require explicit in-app approval. Source records and redirects survive approved merges; operational undo restores prior snapshots.
8. Bootstrap supports a manual editable scaffold and a staged Codex blueprint request. Provider output must satisfy a constrained JSON schema, then the user edits and approves it. Questions and source run identity persist. A provider exit status never installs a blueprint automatically.

## Runtime trust boundary

The HTTP server is loopback only with an allowlisted Host, same-origin checks, JSON-only mutation bodies, and a random per-process capability token. Mutating APIs and state APIs require that token. No arbitrary shell command endpoint exists. Git and Codex use argument arrays, not shell interpolation. External-resource GLB files, oversize requests/assets, excessive model counts, and unsafe asset paths are rejected. Common credential patterns are redacted from provider-bound context and captured output. This redaction is heuristic, not a substitute for reviewing context before sending.

UI uploads are local media; GLB preview is independent of Unity integration. Images/audio and GLB source files are stored separately from revisions with hashes. Rendering limits protect common cases, but hostile compressed textures still need stronger decoding budgets before this becomes a multi-user product.

## Risks and remaining dependencies

| Risk | Mitigation / current limit |
| --- | --- |
| No actual game repository or Unity editor | Clear example data; read-only discovery; helper supplied with compilation unverified |
| Codex CLI protocol/version changes | Narrow adapter; recorded transport; actual model path requires project-side acceptance |
| AI shell actions during implementation | Detached worktree, CLI workspace sandbox, scope checked before application; reviewer still inspects changes |
| Operational checkpoints after external patch application | App undo explicitly excludes Git filesystem changes; retained patch and documented Git rollback |
| Export projection differs from canonical Git-first target | Documented one-way projections and deliberate promotion; no silent competing writes |
| Aggregate state grows large | Suitable for solo local use; entity tables/indexed search and retention should follow measured usage |
| Backup completeness and size | Checksum-verified bundles include media and checkpoint history; limit checks and full-directory backup cover larger projects |
| Lexical vs semantic consolidation | Local vocabulary/synonym similarity suggests candidates and differing numeric claims; human review resolves meaning and contradictions |
| Team sharing or plugins | Not enabled; safe declarative views and local scratchpad are the advanced extensions shipped here |

## Migration / backup plan

There was no pre-existing application data to migrate. The application only scaffolds this repository, stores live data under ignored `.local`, and does not touch an external game on discovery. Every normal mutation checkpoints existing state; schema proposals append entries and preserve prior records. Workspace replacement is reviewed and recoverable. External backup imports disable process execution metadata. Restore and merge undo are tested against stable IDs; complete bundles include media and SQLite checkpoint history. Restoration verifies all paths/checksums and retains a full pre-restore recovery bundle. Operational undo restores the prior state without invoking imported process metadata. Git worktree tests verify the original files remain byte-identical until patch approval.

## Continuation review findings

- Evidence is bound to content/asset digests. Specification edits, decision supersession, merges, and new asset revisions reopen affected validation rather than retaining stale completion.
- Merge redirects resolve for old IDs in UI navigation, impact analysis, and context packs; cycles and dangling redirect targets are rejected.
- Canonical exports remove obsolete Markdown projections after merges; the source remains preserved in proposal history and checkpoints.
- Codex streaming updates avoid creating a full checkpoint per chunk. Missing executables, subprocess timeout, and duplicate close/error events are tested.
- Unity XML intake rejects external entities and inconsistent counts; unconfirmed outcomes cannot gate technical verification.
- Full-bundle restore preserves prior history in an independent recovery bundle, disables imported execution, and checks media before committing restored state.
