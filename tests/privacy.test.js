import test from "node:test";
import assert from "node:assert/strict";
import { redact } from "../server/privacy.js";
test("common credential tokens and assignments are removed from provider-bound text", () => {
  const text =
    "api_key=example-value password: hunter2 ghp_abcdefghijklmnopqrstuvwxyz123456 sk-proj-abcdefghijklmnopqrstuvwxyz";
  const safe = redact(text);
  assert.ok(!safe.includes("hunter2"));
  assert.ok(!safe.includes("example-value"));
  assert.ok(!safe.includes("ghp_"));
  assert.ok(!safe.includes("sk-proj-"));
  assert.match(safe, /REDACTED/);
});
