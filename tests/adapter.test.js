import test from "node:test";
import assert from "node:assert/strict";
import { executePlan } from "../server/integrations.js";
const run = { prompt: "Plan the timer" };
test("CLI adapter reports progress and completes once with redacted output", async () => {
  let completions = 0;
  const progress = [];
  const result = await new Promise((resolve) =>
    executePlan(
      run,
      (output, error, code) => {
        completions++;
        resolve({ output, error, code });
      },
      (output) => progress.push(output),
      {
        command: process.execPath,
        env: { ...process.env, NODE_TEST_CONTEXT: undefined },
        args: [
          "-e",
          'process.stdin.resume(); process.stdin.on("data",()=>{console.log("password=fixture-secret");setTimeout(()=>process.exit(0),50)})',
        ],
      },
    ),
  );
  assert.equal(result.code, 0);
  assert.equal(completions, 1);
  assert.ok(progress.length > 0);
  assert.ok(!result.output.includes("fixture-secret"));
});
test("missing executable and timeout become observable failures without duplicate completion", async () => {
  let count = 0;
  const missing = await new Promise((resolve) =>
    executePlan(
      run,
      (output, error, code) => {
        count++;
        resolve({ error, code });
      },
      undefined,
      { command: "/no/such/forge-codex" },
    ),
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(count, 1);
  assert.equal(missing.code, 1);
  assert.match(missing.error, /ENOENT/);
  const timeout = await new Promise((resolve) =>
    executePlan(
      run,
      (output, error, code) => resolve({ error, code }),
      undefined,
      {
        command: process.execPath,
        env: { ...process.env, NODE_TEST_CONTEXT: undefined },
        args: ["-e", "setInterval(()=>{},1000)"],
        timeoutMs: 30,
      },
    ),
  );
  assert.equal(timeout.code, 124);
  assert.match(timeout.error, /time limit/);
});
