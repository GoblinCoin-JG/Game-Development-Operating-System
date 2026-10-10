import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  Store,
  validate,
  recommendations,
  contextPack,
} from "../server/store.js";
import { seed } from "../server/seed.js";
import { action } from "../server/actions.js";
import { discovery } from "../server/integrations.js";
const fresh = () => seed();
test("persistence, canonical exports and checkpoint restoration retain stable IDs", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "forge-"));
  let store = new Store(dir);
  const original = store.get();
  let s = store.get();
  action(s, "comment", { entity_id: "wormhole", text: "Try fifteen minutes" });
  store.save(s);
  store.close();
  store = new Store(dir);
  assert.equal(store.get().inbox.length, 1);
  assert.match(
    readFileSync(path.join(dir, "canonical", "wormhole.md"), "utf8"),
    /id: wormhole/,
  );
  assert.deepEqual(store.undo(), original);
  store.close();
  rmSync(dir, { recursive: true });
});
test("technical verification requires evidence and dependency readiness; gameplay is independent", () => {
  const s = fresh();
  assert.throws(
    () => action(s, "update", { id: "task-timer", build: "verified" }),
    /evidence/,
  );
  action(s, "evidence", {
    entity_id: "task-timer",
    kind: "technical",
    result: "passed",
    summary: "Timer tests passed",
    reference: "tests/timer.xml",
  });
  action(s, "update", { id: "task-timer", build: "verified" });
  assert.equal(
    s.records.find((r) => r.id === "task-timer").gameplay,
    "not tested",
  );
  assert.throws(
    () => action(s, "update", { id: "task-test", gameplay: "accepted" }),
    /playtest/,
  );
  action(s, "playtest", {
    entity_id: "task-test",
    observations: "Three players understood extraction",
    outcome: "accepted",
  });
  assert.equal(
    s.records.find((r) => r.id === "task-test").build,
    "not started",
  );
});
test("dependency cycles, dangling IDs and invalid workflows are rejected", () => {
  const s = fresh();
  s.records.find((r) => r.id === "loop").depends_on = ["wormhole"];
  assert.throws(() => validate(s), /cycle/);
  s.records.find((r) => r.id === "loop").depends_on = ["missing"];
  assert.throws(() => validate(s), /dependency/);
  s.records.find((r) => r.id === "loop").depends_on = [];
  s.records[0].design = "fake";
  assert.throws(() => validate(s), /design/);
});
test("schema approval adds dynamic type and section; rejection never installs it", () => {
  const s = fresh();
  action(s, "proposal", {
    kind: "schema",
    title: "Loot table",
    name: "Loot table",
    section: "Loot design",
    fields: ["Drop chance"],
  });
  assert.equal(s.types.length, 4);
  action(s, "review", { id: s.proposals[0].id, approve: false });
  assert.equal(s.types.length, 4);
  action(s, "proposal", {
    kind: "schema",
    title: "Loot table",
    name: "Loot table",
    section: "Loot design",
    fields: ["Drop chance"],
  });
  action(s, "review", { id: s.proposals[0].id, approve: true });
  const type = s.types.at(-1);
  action(s, "create", {
    title: "Starter drops",
    type: type.id,
    section: s.sections.at(-1).id,
    description: "Needs design",
    fields: { "Drop chance": "40%" },
  });
  validate(s);
  assert.equal(s.records.at(-1).fields["Drop chance"], "40%");
});
test("merge redirects backlinks, retains source history and rejects stale proposals", () => {
  const s = fresh();
  action(s, "comment", { entity_id: "wormhole", text: "Check duration" });
  action(s, "proposal", {
    kind: "merge",
    title: "Merge loops",
    source_id: "wormhole",
    target_id: "loop",
    description: "A shared extraction specification",
  });
  action(s, "review", { id: s.proposals[0].id, approve: true });
  validate(s);
  assert.equal(s.redirects.wormhole, "loop");
  assert.equal(s.inbox[0].entity_id, "loop");
  assert.equal(s.records.find((r) => r.id === "task-timer").target, "loop");
  assert.equal(s.proposals[0].preserved_source.id, "wormhole");
  const stale = fresh();
  action(stale, "proposal", {
    kind: "merge",
    title: "Merge",
    source_id: "wormhole",
    target_id: "loop",
    description: "New spec",
  });
  action(stale, "update", { id: "wormhole", description: "Changed" });
  assert.throws(
    () => action(stale, "review", { id: stale.proposals[0].id, approve: true }),
    /changed/,
  );
});
test("recommendations cite evidence sources, prioritize ready work and respect focus", () => {
  const s = fresh(),
    list = recommendations(s);
  assert.ok(list.length >= 3);
  assert.equal(list[0].id, "task-timer");
  assert.ok(list.at(-1).blocked_by.includes("task-timer"));
  assert.ok(list.every((r) => r.source_links.includes(r.id) && r.why_now));
  assert.ok(recommendations(s, "short").length >= 3);
});
test("context packs are bounded and trace source revisions", () => {
  const s = fresh();
  const pack = contextPack(s, "task-timer");
  assert.ok(pack.estimated_tokens <= pack.budget);
  assert.ok(pack.sources.some((x) => x.id === "wormhole"));
  assert.ok(pack.sources.every((x) => x.revision === 1));
  assert.equal(contextPack(s, "task-timer", 1).sources.length, 0);
});
test("blueprint creates unresolved records for a new genre after explicit approval", () => {
  const s = fresh();
  action(s, "proposal", {
    kind: "blueprint",
    title: "New game",
    name: "Garden music",
    premise: "A musical gardening game",
    sections: ["Melodies", "Gardens"],
  });
  assert.equal(s.project.title, "Scavengers Pit");
  action(s, "review", { id: s.proposals[0].id, approve: true });
  validate(s);
  assert.equal(s.project.title, "Garden music");
  assert.equal(s.sections[0].title, "Melodies");
  assert.ok(
    s.records
      .filter((r) => r.type === "mechanic")
      .every((r) => r.design === "idea"),
  );
  assert.equal(recommendations(s).length, 3);
});
test("decision history supersedes prior decision without deleting it", () => {
  const s = fresh();
  for (const statement of ["10 minutes", "15 minutes"]) {
    action(s, "proposal", {
      kind: "decision",
      title: "Window",
      entity_id: "wormhole",
      statement,
      rationale: "Pacing",
    });
    action(s, "review", { id: s.proposals[0].id, approve: true });
  }
  assert.equal(s.decisions[1].status, "superseded");
  assert.equal(s.decisions[0].supersedes_id, s.decisions[1].id);
  assert.equal(
    s.records.find((r) => r.id === "wormhole").description,
    "15 minutes",
  );
});
test("Unity discovery detects editor lock without changing project data", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "forge-unity-"));
  mkdirSync(path.join(dir, "ProjectSettings"));
  mkdirSync(path.join(dir, "Temp"));
  writeFileSync(
    path.join(dir, "ProjectSettings", "ProjectVersion.txt"),
    "m_EditorVersion: 6000.0.1f1",
  );
  writeFileSync(path.join(dir, "Temp", "UnityLockfile"), "locked");
  const result = discovery(dir);
  assert.equal(result.unity.locked, true);
  assert.equal(result.unity.found, true);
  assert.match(result.unity.version, /6000/);
  assert.equal(
    readFileSync(path.join(dir, "Temp", "UnityLockfile"), "utf8"),
    "locked",
  );
  rmSync(dir, { recursive: true });
});

test("new record IDs are generated server-side and revision uploads require local sources", () => {
  const s = fresh();
  action(s, "create", {
    id: undefined,
    title: "Generated ID",
    type: "task",
    section: "production",
    description: "",
  });
  assert.equal(typeof s.records.at(-1).id, "string");
  validate(s);
  action(s, "revision", {
    entity_id: "backpack",
    source_path: "https://malicious.example/file.glb",
    hash: "x",
    format: "glb",
  });
  assert.throws(() => validate(s), /source path/);
});
test("approved safe view definitions do not execute arbitrary renderer code", () => {
  const s = fresh();
  action(s, "proposal", {
    kind: "view",
    title: "Systems board",
    format: "board",
    section_id: "systems",
  });
  action(s, "review", { id: s.proposals[0].id, approve: true });
  assert.equal(s.views[0].format, "board");
  action(s, "proposal", {
    kind: "view",
    title: "Code view",
    format: "javascript",
    section_id: "systems",
  });
  assert.throws(
    () => action(s, "review", { id: s.proposals[0].id, approve: true }),
    /declarative/,
  );
});
test("Unity manifest imports GUID identities and rejects path traversal", () => {
  const s = fresh();
  const manifest = {
    version: 1,
    unityVersion: "6000.0",
    assets: [{ guid: "a".repeat(32), path: "Assets/Prefabs/Pack.prefab" }],
  };
  action(s, "unity-manifest", manifest);
  assert.equal(s.project.unityManifest.assets[0].guid, "a".repeat(32));
  manifest.assets[0].path = "Assets/../../secret";
  assert.throws(() => action(s, "unity-manifest", manifest), /identity/);
});
test("visual approval is separately evidence-gated", () => {
  const s = fresh();
  assert.throws(
    () => action(s, "update", { id: "backpack", art: "approved" }),
    /visual review/,
  );
  action(s, "evidence", {
    entity_id: "backpack",
    kind: "visual",
    result: "passed",
    summary: "Silhouette reviewed by developer",
    reference: "reviews/pack.md",
  });
  action(s, "update", { id: "backpack", art: "approved" });
  assert.equal(s.records.find((r) => r.id === "backpack").build, "not started");
});
