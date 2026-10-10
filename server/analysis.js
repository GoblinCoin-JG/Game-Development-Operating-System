import { resolveRecordId } from "./store.js";
const stop = new Set(
  "a an the and or of in on to for from with by as is are be this that it its players player game".split(
    " ",
  ),
);
const synonyms = {
  scavenging: "salvage",
  scavenge: "salvage",
  scavenged: "salvage",
  scavenges: "salvage",
  salvaging: "salvage",
  extraction: "extract",
  extracting: "extract",
  extracted: "extract",
  duration: "time",
  countdown: "timer",
  timelimit: "timer",
  backpacks: "backpack",
  looting: "loot",
  collect: "loot",
  collecting: "loot",
  core: "primary",
  gameplay: "play",
  mechanics: "mechanic",
  surviving: "survive",
  survival: "survive",
};
function terms(record) {
  return new Set(
    `${record.title} ${record.description}`
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((w) => w.length > 2 && !stop.has(w))
      .map((w) => synonyms[w] || w.replace(/s$/, "")) || [],
  );
}
export function overlapCandidates(s) {
  const candidates = [];
  const records = s.records.filter((r) => r.type !== "task");
  for (let i = 0; i < records.length; i++)
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i],
        b = records[j],
        x = terms(a),
        y = terms(b),
        common = [...x].filter((w) => y.has(w));
      const score = common.length / Math.sqrt(Math.max(1, x.size * y.size));
      if (score < 0.32 || common.length < 3) continue;
      const numbers = (r) =>
        new Set(r.description.match(/\b\d+(?:\.\d+)?\b/g) || []);
      const n1 = numbers(a),
        n2 = numbers(b),
        conflicts = [...n1, ...n2].filter((n) => !n1.has(n) || !n2.has(n));
      candidates.push({
        source_id: a.id,
        target_id: b.id,
        score: Math.round(score * 100),
        common_terms: common.slice(0, 10),
        conflicts: [...new Set(conflicts)],
        method: "Local vocabulary similarity; human review required",
        source_revision: a.revision,
        target_revision: b.revision,
      });
    }
  return candidates.sort((a, b) => b.score - a.score).slice(0, 20);
}
export function impactAnalysis(s, entityId) {
  entityId = resolveRecordId(s, entityId);
  const source = s.records.find((x) => x.id === entityId);
  if (!source) throw Error("Record not found");
  const found = new Set([entityId]);
  const edges = [];
  const queue = [entityId];
  while (queue.length) {
    const id = queue.shift();
    for (const r of s.records) {
      const relation = (r.depends_on || []).includes(id)
        ? "prerequisite"
        : r.target === id
          ? "task target"
          : (r.source_refs || []).includes(id)
            ? "source reference"
            : null;
      if (!relation) continue;
      edges.push({ from: r.id, to: id, relation });
      if (!found.has(r.id)) {
        found.add(r.id);
        queue.push(r.id);
      }
    }
  }
  const impacted = s.records.filter((r) => found.has(r.id));
  return {
    entity_id: entityId,
    source_revision: source.revision,
    records: impacted.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      revision: r.revision,
      build: r.build,
      acceptance_criteria: r.acceptance_criteria || "",
    })),
    edges,
    decisions: s.decisions.filter((d) =>
      d.scope_ids?.some((id) => found.has(id)),
    ),
    evidence: s.evidence.filter((e) => found.has(e.entity_id)),
    files: [...new Set(impacted.flatMap((r) => r.linked_files || []))],
    checks: [
      "Review dependent specifications and prior decisions.",
      "Re-run cited technical and integration checks for affected records.",
      "Review HUD, tutorials, balance, and human pacing where relevant.",
    ],
    limitations:
      "This analysis follows persisted links. Unindexed engine/code relationships may be missing.",
  };
}
