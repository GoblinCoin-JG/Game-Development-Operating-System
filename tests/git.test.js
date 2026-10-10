import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import {
  cleanRepository,
  prepareImplementation,
  captureImplementation,
  applyImplementation,
  discardImplementation,
} from "../server/git.js";
function fixture() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "forge-git-"));
  const root = path.join(dir, "project");
  spawnSync("git", ["init", root]);
  spawnSync("git", ["-C", root, "config", "user.name", "Test"]);
  spawnSync("git", ["-C", root, "config", "user.email", "test@example.com"]);
  writeFileSync(path.join(root, "timer.cs"), "original");
  spawnSync("git", ["-C", root, "add", "."]);
  spawnSync("git", ["-C", root, "commit", "-m", "Initial"]);
  return { dir, root };
}
test("implementation stays isolated until reviewed; application preserves HEAD and leaves validation pending", () => {
  const { dir, root } = fixture();
  try {
    const info = prepareImplementation(root, path.join(dir, "data"), "run", [
      "timer.cs",
    ]);
    writeFileSync(path.join(info.dir, "timer.cs"), "changed");
    const preview = captureImplementation(info, path.join(dir, "data"), "run");
    assert.match(preview.diff, /changed/);
    assert.equal(readFileSync(path.join(root, "timer.cs"), "utf8"), "original");
    applyImplementation(info, preview.patch);
    assert.equal(readFileSync(path.join(root, "timer.cs"), "utf8"), "changed");
    assert.throws(() => cleanRepository(root), /uncommitted/);
    discardImplementation(info);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
test("scope violations cannot be applied and dirty projects cannot be isolated", () => {
  const { dir, root } = fixture();
  try {
    assert.throws(
      () => prepareImplementation(root, dir, "bad", ["../escape"]),
      /Scope/,
    );
    const info = prepareImplementation(root, path.join(dir, "data"), "run", [
      "timer.cs",
    ]);
    writeFileSync(path.join(info.dir, "unapproved.cs"), "change");
    assert.throws(
      () => captureImplementation(info, path.join(dir, "data"), "run"),
      /outside/,
    );
    assert.equal(readFileSync(path.join(root, "timer.cs"), "utf8"), "original");
    discardImplementation(info);
    writeFileSync(path.join(root, "timer.cs"), "user changes");
    assert.throws(
      () => prepareImplementation(root, dir, "dirty", ["timer.cs"]),
      /uncommitted/,
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});
