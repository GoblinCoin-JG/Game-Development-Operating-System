import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  realpathSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
function git(root, args) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    timeout: 15000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0)
    throw Error(result.stderr?.trim() || "Git operation failed");
  return result.stdout;
}
export function cleanRepository(root) {
  if (!root || !existsSync(root))
    throw Error("Connect an existing project repository first");
  const canonical = realpathSync(root);
  if (git(canonical, ["rev-parse", "--show-toplevel"]).trim() !== canonical)
    throw Error("Select the repository root");
  if (git(canonical, ["status", "--porcelain"]).trim())
    throw Error(
      "Project has uncommitted changes. Commit or stash them before an implementation session.",
    );
  return {
    root: canonical,
    head: git(canonical, ["rev-parse", "HEAD"]).trim(),
  };
}
export function prepareImplementation(root, local, runId, scope) {
  if (
    !Array.isArray(scope) ||
    !scope.length ||
    scope.some(
      (file) =>
        typeof file !== "string" ||
        !file.trim() ||
        path.isAbsolute(file) ||
        file
          .split(/[\\/]/)
          .some((x) => ["..", ".git", "node_modules"].includes(x)) ||
        file.endsWith(".meta"),
    )
  )
    throw Error(
      "Scope must list relative files; traversal, metadata, and repository internals are prohibited",
    );
  const repo = cleanRepository(root);
  const dir = path.join(local, "worktrees", runId);
  mkdirSync(path.dirname(dir), { recursive: true });
  git(repo.root, ["worktree", "add", "--detach", dir, repo.head]);
  return { ...repo, dir, scope };
}
export function captureImplementation(info, local, runId) {
  const changed = git(info.dir, [
    "status",
    "--porcelain",
    "--untracked-files=all",
  ]);
  const names = git(info.dir, [
    "ls-files",
    "--modified",
    "--deleted",
    "--others",
    "--exclude-standard",
    "-z",
  ])
    .split("\0")
    .filter(Boolean);
  if (names.some((file) => !info.scope.includes(file)))
    throw Error(
      "Agent changed files outside the approved scope. Changes remain isolated; application is blocked.",
    );
  for (const file of names) {
    const full = path.join(info.dir, file);
    if (
      existsSync(full) &&
      !realpathSync(full).startsWith(realpathSync(info.dir) + path.sep)
    )
      throw Error("Escaping symlink detected");
  }
  git(info.dir, ["add", "--all"]);
  const diff = git(info.dir, ["diff", "--cached", "--binary", "HEAD"]);
  if (/new file mode 120000|old mode 120000|new mode 120000/.test(diff))
    throw Error("Symlink changes are not permitted");
  mkdirSync(path.join(local, "run-artifacts"), { recursive: true });
  const patch = path.join(local, "run-artifacts", runId + ".patch");
  writeFileSync(patch, diff);
  return { patch, diff, files: names, changed: !!changed.trim() };
}
export function applyImplementation(info, patch) {
  const current = cleanRepository(info.root);
  if (current.head !== info.head)
    throw Error("Project HEAD changed; prepare a fresh implementation");
  const bytes = readFileSync(patch);
  if (!bytes.length) throw Error("No changes to apply");
  git(info.root, ["apply", "--check", "--binary", patch]);
  git(info.root, ["apply", "--binary", patch]);
  return git(info.root, ["status", "--porcelain"]);
}
export function discardImplementation(info) {
  if (info?.dir && existsSync(info.dir))
    git(info.root, ["worktree", "remove", "--force", info.dir]);
}
