import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { Store, recommendations } from "../server/store.js";
import { seed } from "../server/seed.js";
import { action } from "../server/actions.js";
import { exportBundle, restoreBundle, verifyBundle } from "../server/backup.js";
import { overlapCandidates, impactAnalysis } from "../server/analysis.js";
import { parseUnityReport } from "../server/reports.js";
import { extractBlueprint } from "../server/integrations.js";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function resign(bundle) {
  const { manifest_sha256, ...data } = bundle;
  return { ...data, manifest_sha256: hash(JSON.stringify(data)) };
}
test("complete bundle restores media, checkpoints, stable IDs, and disables imported execution", () => {
  const sourceDir = mkdtempSync(path.join(os.tmpdir(), "forge-source-")),
    destination = mkdtempSync(path.join(os.tmpdir(), "forge-restored-"));
  let source, target;
  try {
    source = new Store(sourceDir);
    target = new Store(destination);
    mkdirSync(path.join(sourceDir, "assets"));
    const bytes = Buffer.from("local audio fixture");
    writeFileSync(path.join(sourceDir, "assets", "sound.wav"), bytes);
    const s = source.get();
    action(s, "revision", {
      entity_id: "backpack",
      source_path: "/media/sound.wav",
      format: "wav",
      hash: hash(bytes),
    });
    source.save(s);
    action(s, "plan", { entity_id: "task-timer" });
    source.save(s);
    const bundle = exportBundle(source);
    const result = restoreBundle(target, bundle);
    assert.equal(result.files_restored, 1);
    assert.equal(result.checkpoints_restored, 2);
    assert.equal(
      readFileSync(path.join(destination, "assets", "sound.wav"), "utf8"),
      "local audio fixture",
    );
    assert.equal(
      target.get().records.find((r) => r.id === "backpack").revisions[0]
        .source_path,
      "/media/sound.wav",
    );
    assert.match(target.get().runs[0].status, /disabled/);
    assert.equal(target.undo().project.id, seed().project.id);
  } finally {
    source?.close();
    target?.close();
    rmSync(sourceDir, { recursive: true });
    rmSync(destination, { recursive: true });
  }
});
test("bundle checksum, unsafe paths, missing media and conflicting files are rejected without changing state", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "forge-bundle-"));
  const store = new Store(root);
  try {
    const bundle = exportBundle(store);
    const changed = structuredClone(bundle);
    changed.state.project.title = "Corrupt";
    assert.throws(() => verifyBundle(changed), /checksum/);
    const malicious = resign({
      ...bundle,
      files: [
        {
          path: "assets/../../escape.wav",
          sha256: hash("x"),
          base64: Buffer.from("x").toString("base64"),
        },
      ],
    });
    assert.throws(() => verifyBundle(malicious), /Unsafe/);
    assert.throws(() => restoreBundle(store, malicious), /Unsafe/);
    const missing = structuredClone(bundle);
    missing.state.records.find((r) => r.id === "backpack").revisions = [
      { source_path: "/media/missing.wav" },
    ];
    assert.throws(() => verifyBundle(resign(missing)), /missing referenced/);
    assert.equal(store.get().project.title, "Scavengers Pit");
  } finally {
    store.close();
    rmSync(root, { recursive: true });
  }
});
test("overlap suggestions expose differing numeric claims but do not merge automatically", () => {
  const s = seed();
  action(s, "create", {
    title: "Core scavenging loop",
    type: "mechanic",
    section: "systems",
    description:
      "Players enter a derelict colony, collect salvage, and reach extraction before the event window closes. Duration 15 minutes.",
  });
  const candidates = overlapCandidates(s);
  assert.ok(
    candidates.some((c) => c.source_id === "loop" || c.target_id === "loop"),
  );
  assert.equal(s.records.length, 10);
  assert.ok(
    candidates.every(
      (c) =>
        c.source_revision && c.target_revision && c.method.includes("review"),
    ),
  );
});
test("impact follows transitive dependencies and task targets with evidence provenance", () => {
  const s = seed();
  action(s, "evidence", {
    entity_id: "task-test",
    kind: "technical",
    result: "failed",
    summary: "Failure",
    reference: "report.xml",
  });
  const impact = impactAnalysis(s, "loop");
  assert.ok(impact.records.some((r) => r.id === "wormhole"));
  assert.ok(impact.records.some((r) => r.id === "task-test"));
  assert.equal(impact.evidence.length, 1);
  assert.ok(
    impact.edges.some((e) => e.from === "task-test" && e.to === "task-timer"),
  );
});
test("NUnit reports preserve failures and cannot silently verify unknown outcomes", () => {
  const s = seed(),
    xml =
      '<test-run result="Failed" total="2" passed="1" failed="1" skipped="0"><test-case fullname="Timer.Start" result="Passed"/><test-case fullname="Timer.End" result="Failed"/></test-run>';
  action(s, "unity-report", {
    xml,
    entity_id: "task-timer",
    name: "timer-results.xml",
  });
  assert.equal(s.evidence[0].result, "failed");
  assert.equal(
    s.records.find((r) => r.id === "task-timer").build,
    "not started",
  );
  assert.equal(
    parseUnityReport(
      '<test-run total="1"><test-case result="Unknown"/></test-run>',
    ).result,
    "unconfirmed",
  );
  assert.throws(
    () =>
      parseUnityReport(
        '<!DOCTYPE xml [<!ENTITY a SYSTEM "file:///etc/passwd">]><test-run total="1" passed="1" result="Passed"/>',
      ),
    /entities/,
  );
  assert.throws(
    () =>
      parseUnityReport(
        '<test-run total="1" passed="1" failed="1" result="Passed"/>',
      ),
    /counts/,
  );
});
test("pinned suggestions preserve dependency blocks and dismissals retain the task with a reason", () => {
  const s = seed();
  action(s, "recommendation", { id: "task-slots", mode: "pin" });
  assert.equal(recommendations(s)[0].id, "task-slots");
  action(s, "recommendation", { id: "task-test", mode: "pin" });
  assert.ok(
    recommendations(s)
      .find((r) => r.id === "task-test")
      .blocked_by.includes("task-timer"),
  );
  assert.throws(
    () => action(s, "recommendation", { id: "task-slots", mode: "dismiss" }),
    /reason/,
  );
  action(s, "recommendation", {
    id: "task-slots",
    mode: "dismiss",
    reason: "Focus on timer",
  });
  assert.ok(!recommendations(s).some((r) => r.id === "task-slots"));
  assert.ok(s.records.some((r) => r.id === "task-slots"));
});
test("AI blueprint result is validated and remains uninstalled until human approval", () => {
  const s = seed();
  action(s, "bootstrap-plan", {
    name: "Garden music",
    premise: "Musical flower gardening",
  });
  assert.equal(s.runs[0].mode, "bootstrap");
  assert.equal(s.runs[0].status, "prepared");
  assert.equal(s.project.title, "Scavengers Pit");
  const output = JSON.stringify({
    type: "item.completed",
    item: {
      type: "agent_message",
      text: JSON.stringify({
        name: "Garden music",
        premise: "Musical flower gardening",
        sections: ["Songs", "Flowers"],
        questions: ["How are melodies scored?"],
      }),
    },
  });
  assert.deepEqual(extractBlueprint(output).sections, ["Songs", "Flowers"]);
  assert.throws(
    () =>
      extractBlueprint(
        '{"name":"Bad","premise":"x","sections":[{"code":"alert(1)"}]}',
      ),
    /schema/,
  );
});
test("changing canonical content invalidates old verification and requires current evidence", () => {
  const s = seed();
  action(s, "evidence", {
    entity_id: "task-timer",
    kind: "technical",
    result: "passed",
    summary: "Original timer passed",
    reference: "original.xml",
  });
  action(s, "update", { id: "task-timer", build: "verified" });
  assert.equal(s.records.find((r) => r.id === "task-timer").build, "verified");
  action(s, "update", {
    id: "task-timer",
    description: "New timeout behavior",
  });
  assert.equal(
    s.records.find((r) => r.id === "task-timer").build,
    "in progress",
  );
  assert.throws(
    () => action(s, "update", { id: "task-timer", build: "verified" }),
    /evidence/,
  );
});
test("archived source IDs resolve in scoped context and impact after consolidation", async () => {
  const { contextPack, validate } = await import("../server/store.js");
  const s = seed();
  action(s, "proposal", {
    kind: "merge",
    title: "Merge window",
    source_id: "wormhole",
    target_id: "loop",
    description: "Canonical extraction loop",
  });
  action(s, "review", { id: s.proposals[0].id, approve: true });
  assert.equal(contextPack(s, "wormhole").entity_id, "loop");
  assert.equal(impactAnalysis(s, "wormhole").entity_id, "loop");
  s.redirects.loop = "wormhole";
  assert.throws(() => validate(s), /Redirect cycle/);
});
test("large valid media backup encoding is checked without recursive regex limits", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "forge-large-bundle-"));
  const store = new Store(root);
  try {
    const bundle = exportBundle(store);
    const bytes = Buffer.alloc(1024 * 1024, 42);
    bundle.files = [
      {
        path: "assets/large.wav",
        sha256: hash(bytes),
        base64: bytes.toString("base64"),
      },
    ];
    assert.equal(
      verifyBundle(resign(bundle)).decoded[0].bytes.length,
      bytes.length,
    );
  } finally {
    store.close();
    rmSync(root, { recursive: true });
  }
});
test("a newer failed test invalidates a prior pass for unchanged content", () => {
  const s = seed();
  action(s, "evidence", {
    entity_id: "task-timer",
    kind: "technical",
    result: "passed",
    summary: "Initially passed",
    reference: "initial.xml",
  });
  action(s, "update", { id: "task-timer", build: "verified" });
  action(s, "unity-report", {
    entity_id: "task-timer",
    name: "regression.xml",
    xml: '<test-run result="Failed" total="1" passed="0" failed="1"/>',
  });
  assert.equal(s.records.find((r) => r.id === "task-timer").build, "blocked");
  assert.throws(
    () => action(s, "update", { id: "task-timer", build: "verified" }),
    /evidence/,
  );
});
