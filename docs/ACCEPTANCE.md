# Implementation phases and acceptance evidence

This report distinguishes implemented app behavior from engine/provider-dependent verification. The application spans all requested phase areas, but the entire research roadmap is not claimed complete.

| Phase | Implemented and reviewed | Verification boundary |
| --- | --- | --- |
| 0 — Reconnaissance | Empty-repository inventory, architecture, loopback server, Codex capability/status discovery, Unity discovery/lock check, GLB viewer | No original Unity repository, prior research, or Unity runtime available; live CLI/App Server startup attempted but blocked by read-only Codex runtime home |
| 1 — Daily driver | Editable approved manual and AI blueprint intake, dynamic types/sections and fields, canonical records/backlinks, next actions, requests, decisions, bounded context packs, scoped plans and isolated Git changes | AI output schema/approval paths are tested; live provider turn is blocked by runtime initialization. A real Scavengers Pit mechanic needs the actual game project |
| 2 — Assets | Registry, uploaded revisions, hashes/provenance, 3D orbit/wireframe/animation/material metadata, images/audio, comparison, feedback, separate art/build evidence | FBX/prefab conversion, real asset integration, and artistic approval need engine/tooling and human review |
| 3 — Reliability/adaptivity | Overlap candidates with numeric differences, transitive impact analysis, reviewed merges with resolvable redirects, stale-revision checks, media/history bundle recovery, decision history, digest-bound evidence, NUnit report intake, ranked/pinned/dismissed actions, custom maturity axes, safe views, playtests | Similarity is a local vocabulary heuristic; unindexed engine/code relationships and human quality judgments require project-side review. No automated Unity execution is claimed |
| 4 — Optional extensions | Loot balance scratchpad, declarative view catalog, read-only Unity GUID manifest exporter, controlled worktree implementation | Executable plugin sandbox, multi-agent sessions, richer scene hooks, team sync, and external asset generators are not enabled |

## Automated checks

Final result: **31 domain/adapter/Git tests and 15 production-browser journeys passed**. TypeScript checking and the production build passed. The browser suite serves `dist/` through the loopback API server, including the root route.

- TypeScript static checking.
- Domain and subprocess adapter tests for streaming progress, timeout and startup errors, AI blueprint result validation, complete-bundle media/history restoration, checksums/path guards/large-file encoding, overlap and transitive impact, Unity XML reports, content-digest invalidation, archived-ID resolution, pin/dismiss behavior, persistence/reopen, canonical projection, restoration with stable IDs, dependency cycles and integrity, evidence gates, independent gameplay validation, schema installation/rejection, recommendation prerequisites/citations, bounded context, unknown-genre bootstrap, decision supersession, merge history/redirection, stale merge rejection, Unity locks, server-generated IDs, safe view installation, manifest identity/traversal, and credential redaction.
- Git fixture tests prove isolation until approval, reviewed application, out-of-scope rejection, unsafe scope rejection, and protection of uncommitted project changes.
- Browser journeys cover all views without console errors, dynamic type approval and record persistence, linked inbox/context preparation, technical evidence gating, merge/undo, new-genre bootstrap, mobile layout, HTTP token/origin guards, uploaded GLB rendering/persistence, safe configured views, impact review, complete bundle download/approved restoration, failed Unity report intake, staged AI bootstrap, and persistent pin/dismiss controls.
- Production bundling and loopback HTTP smoke check.

Screenshots: [Desktop](desktop-preview.png), [Mobile](mobile-preview.png), [Impact review](impact-review-preview.png). Browser tests use separate temporary data and do not alter the development example workspace.

## Manual review

The interface uses a VS Code style activity rail, explorer hierarchy, editor tabs, inspector, log panel, and status bar. Warm amber accents, the orbital-colony illustration, independent maturity tracks, and live asset blockout reinforce game-development use. Desktop and 390-pixel mobile layouts were visually inspected. All mutations save through the local API; labels clearly distinguish example assets, prepared checklists, provider execution, developer evidence, and engine validation.

## Required project-side acceptance

A real Unity project is necessary to compile the editor helper, ingest its GUID manifest, convert/import a real asset, run engine tests, and perform human playtesting. A provider-backed Codex planning/implementation session must be exercised in a disposable copy of that project before daily use. The installed CLI and App Server were actually invoked here: both failed during state initialization because `/run/codex-environment/codex-home` is read-only. No provider completion was fabricated from that failure. The transport and Git isolation are implemented; live provider behavior is not inferred from unit fixtures. No engine asset, scene, executable plugin, external publication, or team integration is reported complete without that evidence.

The full goal remains blocked on access to a real Unity repository/editor and a Codex runtime with writable state. The project path has been requested; none was supplied during implementation. Optional executable plugins, team sync, multi-agent sessions, and external generators are intentionally not reported implemented.
