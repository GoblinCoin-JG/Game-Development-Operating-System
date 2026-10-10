import { id, event, contextPack } from "./store.js";
import { redact } from "./privacy.js";
import { parseUnityReport } from "./reports.js";
import { recordDigest, passingEvidence, recordFailure } from "./evidence.js";
export function action(s, op, p) {
  const now = new Date().toISOString();
  const originalDigests = new Map(
    s.records.map((r) => [r.id, recordDigest(r)]),
  );
  const find = (rid) => {
    const r = s.records.find((x) => x.id === rid);
    if (!r) throw Error("Record not found");
    return r;
  };
  const create = (data) => ({
    project_id: s.project.id,
    type: "task",
    title: "Untitled",
    description: "",
    section: s.sections[0].id,
    status: "active",
    created_at: now,
    updated_at: now,
    created_by: "Developer",
    revision: 1,
    source_refs: [],
    design: "idea",
    build: "not started",
    gameplay: "not tested",
    depends_on: [],
    ...data,
    id: id(),
    project_id: s.project.id,
    revision: 1,
    created_at: now,
    updated_at: now,
  });
  if (op === "create") {
    if (!p.title?.trim()) throw Error("Title required");
    s.records.push(create(p));
    event(s, `Created ${p.title}`);
  } else if (op === "update") {
    const r = find(p.id);
    if (p.art === "approved" && !passingEvidence(s, r, "visual"))
      throw Error("Art approval requires passing visual review evidence");
    if (
      p.knowledge_state === "verified in build" &&
      !passingEvidence(s, r, "integration")
    )
      throw Error(
        "Verified-in-build knowledge requires passing integration evidence",
      );
    if (p.build === "verified") {
      const passed = passingEvidence(s, r, "technical");
      if (!passed)
        throw Error(
          "Technical verification requires passing technical evidence",
        );
      if (
        (r.depends_on || []).some((dep) => {
          const x = find(dep);
          return x.build !== "verified" && x.design !== "approved";
        })
      )
        throw Error("Unmet prerequisites prevent verification");
    }
    if (
      p.gameplay === "accepted" &&
      !s.playtests.some((t) => t.entity_id === r.id && t.outcome === "accepted")
    )
      throw Error("Gameplay acceptance requires an accepted human playtest");
    const { id: _, revision, project_id, created_at, created_by, ...patch } = p;
    const before = recordDigest(r);
    Object.assign(r, patch, { revision: r.revision + 1, updated_at: now });
    if (recordDigest(r) !== before) {
      if (r.build === "verified") r.build = "in progress";
      if (r.art === "approved") r.art = "polish";
      if (r.knowledge_state === "verified in build")
        r.knowledge_state = "needs decision";
    }
    event(s, `Updated ${r.title} · revision ${r.revision}`);
  } else if (op === "comment") {
    const r = find(p.entity_id);
    if (!p.text?.trim()) throw Error("Comment required");
    s.inbox.unshift({
      id: id(),
      entity_id: r.id,
      text: p.text,
      status: "open",
      at: now,
      owner: "Developer",
    });
    event(s, `New request on ${r.title}`);
  } else if (op === "bootstrap-plan") {
    if (!p.name?.trim() || !p.premise?.trim())
      throw Error("Game name and premise required");
    if (p.name.length > 120 || p.premise.length > 6000)
      throw Error(
        "AI bootstrap supports names under 120 characters and descriptions under 6000 characters",
      );
    const run = {
      id: id(),
      entity_id: null,
      title: `Blueprint: ${p.name}`,
      at: now,
      status: "prepared",
      mode: "bootstrap",
      context: {
        project: p.name,
        entity_id: null,
        budget: 1800,
        estimated_tokens: Math.ceil(p.premise.length / 4),
        sources: [],
      },
      steps: [
        "Propose project-specific sections and unresolved questions.",
        "Return an editable JSON blueprint.",
        "Developer reviews and edits the blueprint.",
        "Install only after explicit workspace approval.",
      ],
      prompt: redact(
        `Plan only. Do not edit files or execute commands. Propose a game workspace from this user description. Return only JSON with keys name (string), premise (string), milestone (string), sections (array of section title strings), questions (array of unresolved question strings). Do not invent approved decisions or claim implementation.\nName: ${p.name}\nDescription: ${p.premise}\nConstraints: ${p.constraints || "Not specified"}`,
      ),
      output: "",
      error: "",
    };
    s.runs.unshift(run);
    event(s, "Prepared AI bootstrap request; no provider execution yet");
  } else if (op === "inbox-status") {
    const item = s.inbox.find((x) => x.id === p.id);
    if (!item) throw Error("Request not found");
    if (!["open", "planned", "closed"].includes(p.status))
      throw Error("Invalid status");
    item.status = p.status;
    event(s, `Request ${p.status}`);
  } else if (op === "plan") {
    const r = find(p.entity_id);
    const pack = contextPack(s, r.id);
    const run = {
      id: id(),
      entity_id: r.id,
      title: `Plan: ${r.title}`,
      at: now,
      status: "prepared",
      mode: "plan",
      context: pack,
      steps: [
        "Review the canonical specification and dependencies.",
        "Identify the smallest change and affected files.",
        "Implement in an isolated worktree after change approval.",
        "Run tests; attach evidence and a human review.",
      ],
      prompt: `Plan only. Do not edit files or execute commands.\nProject: ${s.project.title}\nTask: ${r.title}\nRequest: ${p.request || r.description}\nAcceptance: ${r.acceptance_criteria || "Propose explicit criteria."}\nSources:\n${JSON.stringify(pack)}\nReturn a scoped plan, risks, affected files, tests, and questions.`,
      output: "",
      error: "",
    };
    run.prompt = redact(run.prompt);
    s.runs.unshift(run);
    if (p.inbox_id) {
      const inbox = s.inbox.find((x) => x.id === p.inbox_id);
      if (inbox) inbox.status = "planned";
    }
    event(s, `Prepared scoped context for ${r.title}; no AI execution yet`);
  } else if (op === "evidence") {
    find(p.entity_id);
    if (!p.summary?.trim() || !p.reference?.trim())
      throw Error("Evidence summary and reference required");
    if (
      !["passed", "failed"].includes(p.result) ||
      !["technical", "visual", "integration"].includes(p.kind)
    )
      throw Error("Invalid evidence classification");
    s.evidence.unshift({
      id: id(),
      ...p,
      at: now,
      source: "Developer supplied",
      record_digest: recordDigest(find(p.entity_id)),
    });
    if (p.result === "failed") recordFailure(find(p.entity_id), p.kind);
    event(s, `Recorded ${p.kind} evidence: ${p.result}`);
  } else if (op === "playtest") {
    const r = find(p.entity_id);
    if (!p.observations?.trim()) throw Error("Observations required");
    if (!["accepted", "needs redesign", "needs test"].includes(p.outcome))
      throw Error("Invalid outcome");
    s.playtests.unshift({ id: id(), ...p, at: now, source: "Human playtest" });
    r.gameplay = p.outcome;
    r.revision++;
    event(s, `Human playtest recorded for ${r.title}`);
    if (p.followup?.trim())
      s.records.push(
        create({
          title: p.followup,
          description: p.observations,
          section: r.section,
          target: r.id,
          priority: 1,
        }),
      );
  } else if (op === "proposal") {
    if (
      ![
        "schema",
        "merge",
        "decision",
        "workflow",
        "blueprint",
        "view",
      ].includes(p.kind)
    )
      throw Error("Invalid proposal kind");
    if (p.kind === "merge") {
      const a = find(p.source_id),
        b = find(p.target_id);
      if (a.id === b.id) throw Error("Choose two different records");
      p.source_revision = a.revision;
      p.target_revision = b.revision;
    }
    s.proposals.unshift({ id: id(), ...p, status: "pending", at: now });
    event(s, `Proposal awaiting approval: ${p.title}`);
  } else if (op === "review") {
    const pr = s.proposals.find((x) => x.id === p.id);
    if (!pr || pr.status !== "pending")
      throw Error("Proposal is no longer pending");
    if (!p.approve) {
      pr.status = "rejected";
      event(s, `Rejected ${pr.title}; work remains unverified`);
      return s;
    }
    if (pr.kind === "schema") {
      if (!pr.name?.trim()) throw Error("Type name required");
      const slug = id();
      s.types.push({ id: slug, title: pr.name, fields: pr.fields || [] });
      s.sections.push({
        id: slug,
        title: pr.section || pr.name,
        icon: "folder",
      });
    }
    if (pr.kind === "view") {
      if (
        !["list", "document", "board", "gallery"].includes(pr.format) ||
        !s.sections.some((x) => x.id === pr.section_id)
      )
        throw Error("Invalid declarative view");
      s.views = s.views || [];
      s.views.push({
        id: id(),
        title: pr.title,
        format: pr.format,
        section_id: pr.section_id,
      });
    }
    if (pr.kind === "workflow") {
      if (
        !/^[a-z][a-z_]*$/.test(pr.axis) ||
        !Array.isArray(pr.stages) ||
        pr.stages.length < 2 ||
        pr.stages.some((x) => !x.trim())
      )
        throw Error("Invalid workflow");
      if (s.workflows[pr.axis])
        throw Error("Existing axis cannot be replaced; add a new axis");
      s.workflows[pr.axis] = pr.stages;
    }
    if (pr.kind === "decision") {
      find(pr.entity_id);
      if (!pr.statement?.trim()) throw Error("Decision statement required");
      const prior = s.decisions.filter(
        (x) => x.scope_ids.includes(pr.entity_id) && x.status === "approved",
      );
      prior.forEach((x) => (x.status = "superseded"));
      s.decisions.unshift({
        id: id(),
        statement: pr.statement,
        rationale: pr.rationale,
        scope_ids: [pr.entity_id],
        status: "approved",
        supersedes_id: prior[0]?.id,
        approved_by: "Developer",
        approved_at: now,
      });
      const r = find(pr.entity_id);
      r.description = pr.statement;
      r.design = "approved";
      r.revision++;
    }
    if (pr.kind === "merge") {
      const a = find(pr.source_id),
        b = find(pr.target_id);
      if (
        a.revision !== pr.source_revision ||
        b.revision !== pr.target_revision
      )
        throw Error("Records changed; propose a fresh merge");
      if (!pr.description?.trim())
        throw Error("Surviving specification required");
      b.description = pr.description;
      b.revision++;
      s.redirects[a.id] = b.id;
      s.records = s.records.filter((x) => x.id !== a.id);
      for (const r of s.records) {
        r.depends_on = [
          ...new Set((r.depends_on || []).map((x) => (x === a.id ? b.id : x))),
        ].filter((x) => x !== r.id);
        if (r.target === a.id) r.target = b.id;
        r.source_refs = (r.source_refs || []).map((x) =>
          x === a.id ? b.id : x,
        );
      }
      for (const key of ["inbox", "evidence", "playtests", "runs"])
        for (const x of s[key]) if (x.entity_id === a.id) x.entity_id = b.id;
      for (const d of s.decisions)
        d.scope_ids = [
          ...new Set(d.scope_ids.map((x) => (x === a.id ? b.id : x))),
        ];
      pr.preserved_source = a;
    }
    if (pr.kind === "blueprint") {
      if (s.runs.some((r) => r.status === "running"))
        throw Error("Cancel active runs before replacing the workspace");
      if (!pr.name?.trim() || !pr.premise?.trim() || !pr.sections?.length)
        throw Error("Incomplete blueprint");
      s.project = {
        id: id(),
        title: pr.name,
        premise: pr.premise,
        milestone: pr.milestone || "First playable",
        example: false,
        unresolved_questions: pr.questions || [],
        unityRoot: "",
      };
      s.sections = pr.sections.map((title) => ({
        id: id(),
        title,
        icon: "folder",
      }));
      s.records = [];
      s.views = [];
      s.inbox = [];
      s.runs = [];
      s.evidence = [];
      s.playtests = [];
      s.decisions = [];
      s.redirects = {};
      for (const section of s.sections)
        s.records.push(
          create({
            type: "mechanic",
            title: `Define ${section.title.toLowerCase()}`,
            description: `Needs decision: describe how ${section.title.toLowerCase()} serves this game. Premise: ${pr.premise}`,
            section: section.id,
          }),
        );
      for (let i = 0; i < 3; i++)
        s.records.push(
          create({
            title: [
              "Define the first playable loop",
              "Resolve the biggest design uncertainty",
              "Create a proxy and test it",
            ][i],
            description:
              "Manual planning task generated from the approved workspace blueprint. No AI or engine validation claimed.",
            section: s.sections[0].id,
            priority: i + 1,
            estimate: "15–30 min",
          }),
        );
    }
    pr.status = "approved";
    pr.approved_by = "Developer";
    pr.approved_at = now;
    event(s, `Approved ${pr.title}`);
  } else if (op === "revision") {
    const r = find(p.entity_id);
    if (!p.source_path || !p.hash) throw Error("Uploaded source required");
    r.revisions = r.revisions || [];
    r.revisions.unshift({
      id: id(),
      version: r.revisions.length + 1,
      at: now,
      stage: p.stage || "blockout",
      format: p.format,
      source_path: p.source_path,
      hash: p.hash,
      provenance: p.provenance || "Developer upload; license unconfirmed",
      integration: "not validated",
    });
    r.revision++;
    event(s, `Added asset revision to ${r.title}`);
  } else if (op === "unity-manifest") {
    if (p.version !== 1 || !Array.isArray(p.assets) || p.assets.length > 100000)
      throw Error("Invalid Unity manifest");
    for (const a of p.assets)
      if (
        !/^[a-f0-9]{32}$/i.test(a.guid) ||
        typeof a.path !== "string" ||
        !/^(Assets|Packages)\//.test(a.path) ||
        a.path.split("/").includes("..")
      )
        throw Error("Invalid Unity asset identity");
    s.project.unityManifest = { ...p, imported_at: now };
    event(s, `Imported read-only Unity manifest: ${p.assets.length} assets`);
  } else if (op === "recommendation") {
    const record = find(p.id);
    if (record.type !== "task") throw Error("Only tasks can be ranked");
    s.recommendation_preferences = s.recommendation_preferences || {};
    if (p.mode === "dismiss" && !p.reason?.trim())
      throw Error("Dismissal requires a reason");
    if (!["pin", "dismiss", "reset"].includes(p.mode))
      throw Error("Invalid recommendation preference");
    if (p.mode === "reset") delete s.recommendation_preferences[p.id];
    else
      s.recommendation_preferences[p.id] = {
        mode: p.mode,
        reason: p.reason || "",
        at: now,
      };
    event(
      s,
      `${p.mode === "pin" ? "Pinned" : p.mode === "dismiss" ? "Dismissed" : "Reset"} next action: ${record.title}`,
    );
  } else if (op === "unity-report") {
    const subject = find(p.entity_id);
    const report = parseUnityReport(p.xml);
    const reportId = id();
    s.project.testReports = s.project.testReports || [];
    s.project.testReports.unshift({
      id: reportId,
      entity_id: p.entity_id,
      name: p.name || "Unity report",
      at: now,
      ...report,
      xml: p.xml,
    });
    if (report.result !== "unconfirmed")
      s.evidence.unshift({
        id: id(),
        entity_id: p.entity_id,
        kind: "technical",
        result: report.result,
        summary: `${report.passed}/${report.total} tests passed; ${report.failed} failed; ${report.skipped} skipped.`,
        reference: `${p.name || "Unity report"} · SHA-256 ${report.sha256}`,
        at: now,
        source: "Imported Unity test report (user supplied)",
        report_id: reportId,
        record_digest: recordDigest(subject),
      });
    if (report.result === "failed") recordFailure(subject, "technical");
    event(
      s,
      `Imported Unity report: ${report.result}; no engine process was launched`,
    );
  } else if (op === "settings") {
    s.project.unityRoot = p.unityRoot || "";
    event(s, "Updated Unity discovery path");
  } else throw Error("Unknown operation");
  for (const record of s.records) {
    const previous = originalDigests.get(record.id);
    if (previous && previous !== recordDigest(record)) {
      if (record.build === "verified") record.build = "in progress";
      if (record.art === "approved") record.art = "polish";
      if (["accepted", "playtested"].includes(record.gameplay))
        record.gameplay = "needs test";
      if (record.knowledge_state === "verified in build")
        record.knowledge_state = "needs decision";
    }
  }
  return s;
}
