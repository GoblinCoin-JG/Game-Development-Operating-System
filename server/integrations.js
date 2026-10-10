import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { redact } from "./privacy.js";
export function discovery(root) {
  const codex = spawnSync("codex", ["--version"], {
    encoding: "utf8",
    timeout: 3000,
  });
  const auth =
    codex.status === 0
      ? spawnSync("codex", ["login", "status"], {
          encoding: "utf8",
          timeout: 3000,
        })
      : null;
  const project =
    root &&
    existsSync(path.join(root, "ProjectSettings", "ProjectVersion.txt"));
  const version = project
    ? readFileSync(
        path.join(root, "ProjectSettings", "ProjectVersion.txt"),
        "utf8",
      ).split("\n")[0]
    : null;
  const locked = !!(
    root && existsSync(path.join(root, "Temp", "UnityLockfile"))
  );
  return {
    codex: {
      available: codex.status === 0,
      version: (codex.stdout || "").trim(),
      authenticated: auth?.status === 0,
      transport: "CLI planning + scoped implementation adapter",
    },
    unity: {
      found: !!project,
      version,
      locked,
      status: locked
        ? "Editor lock present; batch execution blocked"
        : project
          ? "Discovered; engine validation not performed"
          : "No Unity project connected",
      files: project
        ? ["Assets", "Packages", "ProjectSettings"].flatMap((dir) =>
            existsSync(path.join(root, dir))
              ? readdirSync(path.join(root, dir))
                  .slice(0, 30)
                  .map((f) => `${dir}/${f}`)
              : [],
          )
        : [],
    },
  };
}
export function executePlan(run, onDone, onProgress = () => {}, options = {}) {
  const child = spawn(
    options.command || "codex",
    options.args || [
      "exec",
      "--sandbox",
      run.mode === "implement" ? "workspace-write" : "read-only",
      "--json",
      "--skip-git-repo-check",
      "-",
    ],
    {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: run.isolation?.dir,
      env: options.env || process.env,
    },
  );
  let output = "",
    error = "",
    settled = false,
    timedOut = false,
    lastProgress = 0;
  const finish = (code) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    clearTimeout(force);
    onDone(redact(output), redact(error), timedOut ? 124 : (code ?? 1));
  };
  let force;
  const timeout = setTimeout(() => {
    timedOut = true;
    error += "\nCodex session exceeded its time limit.";
    child.kill("SIGTERM");
    force = setTimeout(() => child.kill("SIGKILL"), 2000);
  }, options.timeoutMs || 120000);
  const progress = () => {
    if (settled || Date.now() - lastProgress < 750) return;
    lastProgress = Date.now();
    onProgress(redact(output), redact(error));
  };
  child.stdout.on("data", (d) => {
    output = (output + d.toString()).slice(-150000);
    progress();
  });
  child.stderr.on("data", (d) => {
    error = (error + d.toString()).slice(-10000);
    progress();
  });
  child.on("error", (e) => {
    error = e.message;
    finish(1);
  });
  child.stdin.on("error", (e) => {
    if (e.code !== "EPIPE") error += "\n" + e.message;
  });
  child.on("close", finish);
  child.stdin.end(run.prompt);
  return child;
}
export function extractBlueprint(output) {
  let messages = [];
  for (const line of output.split("\n")) {
    try {
      const event = JSON.parse(line);
      if (
        event.type === "item.completed" &&
        event.item?.type === "agent_message"
      )
        messages.push(event.item.text);
    } catch {}
  }
  const text = messages.at(-1) || output;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let candidate;
  try {
    candidate = JSON.parse(fenced?.[1] || text.trim());
  } catch {
    throw Error(
      "Codex output did not contain a valid blueprint JSON object; edit a manual proposal instead",
    );
  }
  if (
    typeof candidate.name !== "string" ||
    !candidate.name.trim() ||
    typeof candidate.premise !== "string" ||
    !candidate.premise.trim() ||
    !Array.isArray(candidate.sections) ||
    !candidate.sections.length ||
    candidate.sections.length > 32 ||
    candidate.sections.some(
      (x) => typeof x !== "string" || !x.trim() || x.length > 120,
    )
  )
    throw Error("Blueprint output does not satisfy the safe schema");
  return {
    name: candidate.name.slice(0, 120),
    premise: candidate.premise.slice(0, 20000),
    milestone:
      typeof candidate.milestone === "string"
        ? candidate.milestone.slice(0, 200)
        : "First playable",
    sections: candidate.sections,
    questions: Array.isArray(candidate.questions)
      ? candidate.questions.filter((q) => typeof q === "string").slice(0, 20)
      : [],
  };
}
