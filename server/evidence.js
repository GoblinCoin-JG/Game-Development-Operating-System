import { createHash } from "node:crypto";
export function recordDigest(record) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        title: record.title,
        description: record.description,
        fields: record.fields || {},
        depends_on: record.depends_on || [],
        acceptance_criteria: record.acceptance_criteria || "",
        asset_hash: record.revisions?.[0]?.hash || "",
      }),
    )
    .digest("hex");
}
export function passingEvidence(s, record, kind) {
  const latest = s.evidence.find(
    (e) =>
      e.entity_id === record.id &&
      e.kind === kind &&
      e.record_digest === recordDigest(record),
  );
  return latest?.result === "passed";
}

export function recordFailure(record, kind) {
  if (
    ["technical", "integration"].includes(kind) &&
    ["verified", "integrated"].includes(record.build)
  )
    record.build = "blocked";
  if (kind === "visual" && record.art === "approved") record.art = "polish";
  if (kind === "integration" && record.knowledge_state === "verified in build")
    record.knowledge_state = "needs decision";
}
