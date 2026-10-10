# Forge — Game Development OS

A local-first, browser-based game development workspace with a VS Code inspired shell, warm industrial accents, and a live 3D asset viewport. The included **Scavengers Pit workspace is example data**, not a report about a real game repository.

## Run

Requires Node.js **24+** (uses built-in SQLite) and npm.

```bash
npm ci
npm run dev
```

Open **http://127.0.0.1:4173**. The server binds only to loopback. For a production build:

```bash
npm run build
NODE_ENV=production npm run dev
```

Use `PORT` to choose a port and `FORGE_DATA_DIR` to choose an absolute data directory. The default is `.local/` in this checkout. No deployment or external services are required for manual workflows.

## Use

- **Overview:** dependency-aware recommendations, pinned/dismissed suggestions with reasons, session focus, maturity counts, activity, and an asset preview.
- **Project explorer:** canonical records, search, editable typed fields, backlinks, transitive change impact, advisory vocabulary overlap with conflict review, and list/document/board/gallery views. Add project-specific types and sections without source changes; approve them in Review.
- **Work board:** independent design, build, art, and gameplay axes. Technical verification requires passing developer-supplied technical evidence; gameplay acceptance requires a human playtest. Knowledge marked verified in build requires integration evidence.
- **Asset studio:** upload self-contained GLB v2, images, or audio; orbit, zoom, wireframe, material/triangle summary, animation selection, revisions, comparison, feedback, and independent engine validation. FBX and external-resource glTF require conversion.
- **Inbox & review:** linked requests, explicit proposal approvals/rejections, reversible consolidation, superseding decisions, scoped context packs, streamed Codex session output, and editable AI blueprint intake.
- **Playtests:** human observations and optional follow-up tasks; independent of technical completion.
- **Settings:** Unity discovery and lock checks, Codex status, workflows, portable state exports/restoration, checkpoint undo, and a loot-balancing scratchpad.

## Codex and project files

The installed CLI is discovered at runtime; authenticate it separately with your existing account. Preparing a context pack or blueprint request is offline and does not invoke AI. In the bootstrap dialog, **Prepare AI blueprint plan** stages a prompt; run it through the normal approval flow, then choose **Review AI blueprint** to edit the validated returned structure before installing it. **Review & run plan** asks for approval before a read-only CLI call and sends the displayed request/excerpts to the configured provider.

**Scope implementation** requires a connected Git repository with a clean working tree and exact allowed relative file paths. A detached worktree contains the agent changes. Source files stay unchanged until a reviewed patch is approved. Scope violations, symlink changes, Unity `.meta` edits, dirty working trees, and changed HEAD block application. Applying a patch leaves the project changes uncommitted and the task unverified. Review the logs, run relevant tests in your project, and record evidence. A cancelled/failed session may still contain isolated changes. Worktrees are retained for inspection unless explicitly rejected.

The CLI adapter is implemented and its isolation/application behavior is tested with temporary Git repositories. **Live CLI and App Server smoke attempts failed before a provider turn:** this cloud environment makes `/run/codex-environment/codex-home` read-only, preventing Codex state initialization. The compatibility check in Settings reports this startup failure; subprocess fixtures verify progress, timeout, redaction, and error handling. **Unity compilation/playtesting is blocked** because no Unity game or editor is available in this checkout. See [the phase acceptance report](docs/ACCEPTANCE.md) for remaining engine-dependent verification.

## Unity

Set the existing project repository path in Settings. Discovery reads `ProjectSettings/ProjectVersion.txt`, lists top-level engine files, and checks `Temp/UnityLockfile`. It never launches a batch editor process or rewrites engine metadata.

An optional [editor helper](integrations/unity/ForgeManifestExporter.cs) exports read-only GUID-backed identity and dependencies using Unity AssetDatabase. Copy it into `Assets/Editor` in your game, choose **Tools → Forge → Export read-only asset manifest**, and import its JSON in Settings. This helper is supplied for engine-side verification; it has not been compiled without a Unity installation. It does not convert prefabs/FBX or assert that an asset works in-engine.

## Data and recovery

SQLite stores operational state and a checkpoint before each mutation. Validation evidence is tied to the reviewed content digest; changing a specification or asset reopens relevant verification. Unity NUnit XML reports can be previewed and imported from Settings; unknown outcomes do not create passing evidence and imported reports are labeled user supplied. `.local/canonical/` contains readable Markdown records and a JSON workspace projection. Promote reviewed copies into your game's Git documentation deliberately; the app does not silently commit them. SQLite is the current writable authority; editing the generated projection does not import changes.

- **Export complete backup** in Settings produces a checksum-verified bundle of state, SQLite checkpoint history, media binaries, and saved Git patches. Restore it through the same approval dialog. Bundles support up to 96 MB of decoded files and 150 MB including serialized history; larger projects should use the full-directory backup below.
- State-only JSON export remains available for stable IDs, registry definitions, decisions, inbox, evidence, and run history.
- Back up the **whole `.local/` directory** for asset files, patch artifacts, and database history. With the server stopped, copy it to another location. A state-only JSON export alone does not include media binaries; a complete bundle does.
- Restore JSON or a complete bundle through the explicit review dialog; validation rejects malformed entities, dangling dependencies, cycles, unsafe asset paths, and unsupported versions. Imported run history has execution disabled and cannot apply an old patch or serve as an executable implementation plan. Bundle restore preserves a full pre-restore recovery bundle in `.local/recovery/` and rejects unsafe paths, bad checksums, missing media, or conflicting existing files.
- Undo restores the last operational checkpoint. It does **not** reverse approved changes in an external Git project. For project rollback, inspect the retained patch under `.local/run-artifacts`, use `git apply --check --reverse <patch>` then `git apply --reverse <patch>` only after reviewing current project edits, or recover through your normal Git workflow.

## Checks

```bash
npm run check
npm test
npm run test:e2e
npm run build
```

Browser tests use Chromium at `/usr/bin/chromium`. Override `launchOptions.executablePath` in `playwright.config.js` for your machine, or install Playwright Chromium and remove that override. Test state is separate from the development workspace.

[Architecture and risks](docs/ARCHITECTURE.md) · [Phase acceptance and limits](docs/ACCEPTANCE.md)
