import { spawn } from "node:child_process";
import { redact } from "./privacy.js";
export function probeAppServer() {
  return new Promise((resolve) => {
    const child = spawn("codex", ["app-server", "--listen", "stdio://"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let buffer = "",
      stderr = "",
      settled = false;
    let deadline;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      child.kill("SIGTERM");
      resolve(result);
    };
    deadline = setTimeout(
      () =>
        finish({
          connected: false,
          error: "App Server initialization timed out",
          transport: "stdio JSON-RPC",
        }),
      10000,
    );
    child.on("error", (e) =>
      finish({
        connected: false,
        error: e.code || "Spawn failed",
        transport: "stdio JSON-RPC",
      }),
    );
    child.on("close", () =>
      finish({
        connected: false,
        error: "App Server exited before initialization",
        diagnostics: redact(stderr).slice(0, 1500),
        transport: "stdio JSON-RPC",
      }),
    );
    child.stdin.on("error", () => {});
    child.stderr.on("data", (d) => {
      stderr = (stderr + d.toString()).slice(-3000);
    });
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      if (buffer.length > 1024 * 1024) {
        finish({
          connected: false,
          error: "Unexpected protocol output size",
          transport: "stdio JSON-RPC",
        });
        return;
      }
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        if (message.id !== 1) continue;
        if (message.error) {
          finish({
            connected: false,
            error: message.error.message || "Initialization rejected",
            transport: "stdio JSON-RPC",
          });
          return;
        }
        child.stdin.write(JSON.stringify({ method: "initialized" }) + "\n");
        finish({
          connected: true,
          transport: "stdio JSON-RPC",
          server: message.result?.userAgent || "Codex App Server",
          response_fields: Object.keys(message.result || {}),
          note: "Initialization only; no thread or provider turn created",
        });
      }
    });
    child.stdin.write(
      JSON.stringify({
        id: 1,
        method: "initialize",
        params: {
          clientInfo: {
            name: "forge_game_os",
            title: "Forge Game OS",
            version: "0.1.0",
          },
          capabilities: { experimentalApi: false },
        },
      }) + "\n",
    );
  });
}
