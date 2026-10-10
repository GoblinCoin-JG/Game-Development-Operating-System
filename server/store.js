import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { seed } from "./seed.js";
import { redact } from "./privacy.js";
export class Store {
  constructor(root) {
    this.root = path.resolve(root);
    root = this.root;
    mkdirSync(root, { recursive: true });
    this.db = new DatabaseSync(path.join(root, "workspace.sqlite"));
    this.db.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS snapshots(id INTEGER PRIMARY KEY, data TEXT NOT NULL, at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)",
    );
    if (!this.db.prepare("SELECT data FROM state WHERE id=1").get())
      this.save(seed(), false);
  }
  get() {
    return JSON.parse(
      this.db.prepare("SELECT data FROM state WHERE id=1").get().data,
    );
  }
  save(data, backup = true) {
    validate(data);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (backup)
        this.db
          .prepare(
            "INSERT INTO snapshots(data,at) SELECT data,? FROM state WHERE id=1",
          )
          .run(new Date().toISOString());
      this.db
        .prepare("INSERT OR REPLACE INTO state(id,data) VALUES(1,?)")
        .run(JSON.stringify(data));
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    this.exportCanonical(data);
    return data;
  }
  exportCanonical(data) {
    const dir = path.join(this.root, "canonical");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "workspace.json"),
      JSON.stringify(data, null, 2),
    );
    const wanted = new Set(data.records.map((r) => `${r.id}.md`));
    for (const file of readdirSync(dir))
      if (file.endsWith(".md") && !wanted.has(file))
        unlinkSync(path.join(dir, file));
    for (const r of data.records)
      writeFileSync(
        path.join(dir, `${r.id}.md`),
        `---\nid: ${r.id}\ntype: ${r.type}\nrevision: ${r.revision}\n---\n\n# ${r.title}\n\n${r.description}\n`,
      );
  }
  undo() {
    const row = this.db
      .prepare("SELECT * FROM snapshots ORDER BY id DESC LIMIT 1")
      .get();
    if (!row) throw Error("No checkpoint available");
    const current = this.get();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("UPDATE state SET data=? WHERE id=1").run(row.data);
      this.db.prepare("DELETE FROM snapshots WHERE id=?").run(row.id);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    const data = this.get();
    this.exportCanonical(data);
    return data;
  }
  close() {
    this.db.close();
  }
}
export function validate(s) {
  if (s.version !== 1 || !s.project?.id || !s.project?.title)
    throw Error("Unsupported backup or missing project");
  for (const key of [
    "sections",
    "types",
    "records",
    "inbox",
    "proposals",
    "runs",
    "evidence",
    "playtests",
    "decisions",
    "events",
  ])
    if (!Array.isArray(s[key])) throw Error(`Invalid ${key}`);
  if (!s.workflows || !s.redirects)
    throw Error("Missing workflows or redirects");
  for (const run of s.runs)
    if (
      typeof run.id !== "string" ||
      typeof run.title !== "string" ||
      !run.context ||
      !Array.isArray(run.context.sources) ||
      !Array.isArray(run.steps)
    )
      throw Error("Invalid run history");
  for (const e of s.events)
    if (
      typeof e.id !== "string" ||
      typeof e.message !== "string" ||
      typeof e.at !== "string"
    )
      throw Error("Invalid event history");
  for (const v of s.views || [])
    if (
      !["list", "board", "document", "gallery"].includes(v.format) ||
      !s.sections.some((x) => x.id === v.section_id)
    )
      throw Error("Invalid saved view");
  for (const key of ["sections", "types"]) {
    const registry = new Set();
    for (const entry of s[key]) {
      if (
        typeof entry.id !== "string" ||
        !entry.title?.trim() ||
        registry.has(entry.id)
      )
        throw Error("Invalid registry");
      registry.add(entry.id);
      if (
        key === "types" &&
        (!Array.isArray(entry.fields) ||
          entry.fields.some((f) => typeof f !== "string"))
      )
        throw Error("Invalid type fields");
    }
  }
  for (const [axis, stages] of Object.entries(s.workflows))
    if (
      !/^[a-z][a-z_]*$/.test(axis) ||
      !Array.isArray(stages) ||
      stages.length < 2 ||
      stages.some((x) => typeof x !== "string" || !x.trim())
    )
      throw Error("Invalid workflow registry");
  const ids = new Set();
  for (const r of s.records) {
    if (
      typeof r.id !== "string" ||
      !/^[a-zA-Z0-9_-]+$/.test(r.id) ||
      ids.has(r.id)
    )
      throw Error("Invalid or duplicate record ID");
    ids.add(r.id);
    if (
      typeof r.title !== "string" ||
      !r.title.trim() ||
      typeof r.description !== "string"
    )
      throw Error("Invalid record");
    if (
      !s.types.some((t) => t.id === r.type) ||
      !s.sections.some((t) => t.id === r.section)
    )
      throw Error("Unknown registry type or section");
  }
  for (const r of s.records) {
    if (r.target && !ids.has(r.target)) throw Error("Invalid task target");
    if (
      !Array.isArray(r.depends_on) ||
      !Array.isArray(r.source_refs) ||
      !Number.isInteger(r.revision)
    )
      throw Error("Malformed entity contract");
    for (const rev of r.revisions || [])
      if (
        !/^\/media\/[a-zA-Z0-9_-]+\.(glb|png|jpg|jpeg|webp|wav|mp3|ogg)$/.test(
          rev.source_path,
        )
      )
        throw Error("Invalid asset source path");
    for (const id of r.depends_on || [])
      if (!ids.has(id) || id === r.id) throw Error("Invalid dependency");
    for (const axis of Object.keys(s.workflows))
      if (r[axis] && !s.workflows[axis].includes(r[axis]))
        throw Error(`Invalid ${axis} stage`);
  }
  const walk = (id, seen) => {
    if (seen.has(id)) throw Error("Dependency cycle");
    const next = new Set(seen).add(id);
    for (const dep of s.records.find((r) => r.id === id)?.depends_on || [])
      walk(dep, next);
  };
  for (const id of ids) walk(id, new Set());
  for (const [from, to] of Object.entries(s.redirects)) {
    if (
      !/^[a-zA-Z0-9_-]+$/.test(from) ||
      typeof to !== "string" ||
      !ids.has(resolveRecordId(s, from))
    )
      throw Error("Invalid redirect");
  }
  for (const item of [...s.inbox, ...s.evidence, ...s.playtests])
    if (item.entity_id && !ids.has(item.entity_id))
      throw Error("Missing referenced entity");
}
export function resolveRecordId(s, input) {
  let current = input;
  const visited = new Set();
  while (s.redirects[current]) {
    if (visited.has(current)) throw Error("Redirect cycle");
    visited.add(current);
    current = s.redirects[current];
  }
  return current;
}
export const id = () => randomUUID();
export function event(s, message) {
  s.events.unshift({ id: id(), at: new Date().toISOString(), message });
}
export function recommendations(s, focus = "all") {
  return s.records
    .filter(
      (r) =>
        r.type === "task" &&
        r.build !== "verified" &&
        s.recommendation_preferences?.[r.id]?.mode !== "dismiss",
    )
    .map((r) => {
      const blocked = (r.depends_on || [])
        .map((id) => s.records.find((x) => x.id === id))
        .filter((x) => x && x.build !== "verified" && x.design !== "approved");
      return {
        ...r,
        blocked_by: blocked.map((x) => x.id),
        why_now: blocked.length
          ? `Waiting on ${blocked.map((x) => x.title).join(", ")}.`
          : r.target
            ? `Moves ${s.records.find((x) => x.id === r.target)?.title || r.target} toward the first playable milestone.`
            : "Ready prerequisites; advances your current milestone.",
        score:
          (r.priority || 5) +
          (blocked.length ? 20 : 0) -
          (s.recommendation_preferences?.[r.id]?.mode === "pin" ? 10 : 0) -
          (s.evidence.some(
            (e) =>
              [r.id, r.target].includes(e.entity_id) && e.result === "failed",
          )
            ? 5
            : 0),
        pinned: s.recommendation_preferences?.[r.id]?.mode === "pin",
        expected_output: r.acceptance_criteria || r.description,
        definition_of_done:
          r.acceptance_criteria ||
          "Record technical evidence and the relevant human review.",
        confidence: "Rule-based",
        source_links: [
          r.id,
          ...(r.depends_on || []),
          ...(r.target ? [r.target] : []),
        ],
      };
    })
    .filter((r) => focus !== "short" || /10|15|30/.test(r.estimate || ""))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);
}
export function contextPack(s, entityId, budget = 1800) {
  entityId = resolveRecordId(s, entityId);
  const r = s.records.find((r) => r.id === entityId);
  if (!r) throw Error("Record not found");
  const linked = [
    r,
    ...s.records.filter(
      (x) =>
        x.id !== r.id &&
        ((r.depends_on || []).includes(x.id) || x.id === r.target),
    ),
  ];
  let used = 0;
  const sources = [];
  for (const x of linked) {
    const excerpt = redact(`${x.title}\n${x.description}`);
    const tokens = Math.ceil(excerpt.length / 4);
    if (used + tokens > budget) break;
    used += tokens;
    sources.push({ id: x.id, revision: x.revision, excerpt });
  }
  const decisions = [];
  for (const d of s.decisions.filter((d) =>
    (d.scope_ids || []).includes(entityId),
  )) {
    const item = {
      ...d,
      statement: redact(d.statement),
      rationale: redact(d.rationale || ""),
    };
    const cost = Math.ceil(JSON.stringify(item).length / 4);
    if (used + cost > budget) continue;
    decisions.push(item);
    used += cost;
  }
  return {
    project: s.project.title,
    entity_id: entityId,
    budget,
    estimated_tokens: used,
    sources,
    decisions,
  };
}
