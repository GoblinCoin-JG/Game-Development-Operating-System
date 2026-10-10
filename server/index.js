import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, createHash } from "node:crypto";
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  realpathSync,
  readFileSync,
} from "node:fs";
import { Store, recommendations, contextPack, id, event } from "./store.js";
import { action } from "./actions.js";
import { discovery, executePlan, extractBlueprint } from "./integrations.js";
import { validateGLB } from "./assets.js";
import { exportBundle, restoreBundle, disableImportedRuns } from "./backup.js";
import { overlapCandidates, impactAnalysis } from "./analysis.js";
import { parseUnityReport } from "./reports.js";
import { probeAppServer } from "./app-server.js";
import {
  prepareImplementation,
  captureImplementation,
  applyImplementation,
  discardImplementation,
} from "./git.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const local = process.env.FORGE_DATA_DIR || path.join(root, ".local");
const store = new Store(local);
const token = randomBytes(32).toString("hex");
const port = Number(process.env.PORT || 4173);
const workers = new Map();
const updateProgress = (runId) => (output, error) => {
  const state = store.get(),
    run = state.runs.find((r) => r.id === runId);
  if (run?.status !== "running") return;
  run.live_output = output;
  run.live_error = error;
  store.save(state, false);
};
const dev = process.env.NODE_ENV !== "production";
const vite = dev
  ? await (
      await import("vite")
    ).createServer({
      root,
      server: { middlewareMode: true, hmr: { port: port + 20000 } },
      appType: "spa",
    })
  : null;
const send = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
};
const server = http.createServer(async (req, res) => {
  const host = req.headers.host;
  const origins = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
  if (!["127.0.0.1:" + port, "localhost:" + port].includes(host)) {
    send(res, 403, { error: "Loopback host required" });
    return;
  }
  if (req.headers.origin && !origins.includes(req.headers.origin)) {
    send(res, 403, { error: "Origin rejected" });
    return;
  }
  const url = new URL(req.url, origins[0]);
  try {
    if (url.pathname === "/api/session" && req.method === "GET") {
      send(res, 200, { token });
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      if (req.headers["x-forge-token"] !== token) {
        send(res, 401, { error: "Session capability required" });
        return;
      }
      if (req.method === "GET") {
        const s = store.get();
        if (url.pathname === "/api/state")
          send(res, 200, {
            ...s,
            recommendations: recommendations(
              s,
              url.searchParams.get("focus") || "all",
            ),
          });
        else if (url.pathname === "/api/integrations")
          send(res, 200, discovery(s.project.unityRoot));
        else if (url.pathname === "/api/export") send(res, 200, s);
        else if (url.pathname === "/api/bundle")
          send(res, 200, exportBundle(store));
        else if (url.pathname === "/api/overlaps")
          send(res, 200, overlapCandidates(s));
        else if (url.pathname === "/api/impact")
          send(res, 200, impactAnalysis(s, url.searchParams.get("id")));
        else if (url.pathname === "/api/context")
          send(res, 200, contextPack(s, url.searchParams.get("id")));
        else send(res, 404, { error: "Not found" });
        return;
      }
      if (req.method !== "POST") {
        send(res, 405, { error: "Method not allowed" });
        return;
      }
      if (!req.headers["content-type"]?.startsWith("application/json"))
        throw Error("JSON body required");
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (
          body.length >
          (url.pathname === "/api/restore-bundle" ? 160 : 32) * 1024 * 1024
        )
          throw Error("Request exceeds endpoint size limit");
      }
      const p = JSON.parse(body || "{}");
      let s = store.get();
      if (url.pathname === "/api/probe-app-server") {
        send(res, 200, await probeAppServer());
      } else if (url.pathname === "/api/blueprint-result") {
        const run = s.runs.find((r) => r.id === p.id);
        if (!run || run.mode !== "bootstrap" || run.status !== "review")
          throw Error("A completed bootstrap planning run is required");
        send(res, 200, {
          ...extractBlueprint(run.output),
          source_run_id: run.id,
        });
      } else if (url.pathname === "/api/report-preview") {
        send(res, 200, parseUnityReport(p.xml));
      } else if (url.pathname === "/api/restore-bundle") {
        if (workers.size) throw Error("Cancel active runs before recovery");
        if (p.confirm !== true)
          throw Error("Explicit restore approval required");
        send(res, 200, restoreBundle(store, p.bundle));
      } else if (url.pathname === "/api/action") {
        s = action(s, p.op, p.payload || {});
        store.save(s);
        send(res, 200, s);
      } else if (url.pathname === "/api/restore") {
        if (workers.size)
          throw Error("Cancel active runs before restoring a workspace");
        if (p.confirm !== true)
          throw Error("Explicit restore approval required");
        if (!Array.isArray(p.data?.runs)) throw Error("Invalid backup");
        p.data = disableImportedRuns(p.data);
        store.save(p.data);
        send(res, 200, store.get());
      } else if (url.pathname === "/api/undo") {
        if (workers.size)
          throw Error("Cancel active runs before checkpoint recovery");
        send(res, 200, store.undo());
      } else if (url.pathname === "/api/upload") {
        const ext = path.extname(p.name || "").toLowerCase();
        if (
          ![
            ".glb",
            ".png",
            ".jpg",
            ".jpeg",
            ".webp",
            ".wav",
            ".mp3",
            ".ogg",
          ].includes(ext)
        )
          throw Error(
            "Supported: GLB, images, audio. FBX requires conversion.",
          );
        const bytes = Buffer.from(p.base64 || "", "base64");
        if (!bytes.length || bytes.length > 20 * 1024 * 1024)
          throw Error("Asset must be under 20 MB");
        if (ext === ".glb") validateGLB(bytes);
        const name = id() + ext;
        mkdirSync(path.join(local, "assets"), { recursive: true });
        writeFileSync(path.join(local, "assets", name), bytes);
        send(res, 200, {
          source_path: "/media/" + name,
          hash: createHash("sha256").update(bytes).digest("hex"),
          format: ext.slice(1),
        });
      } else if (url.pathname === "/api/implement") {
        const base = s.runs.find((x) => x.id === p.id);
        if (
          !base ||
          base.mode !== "plan" ||
          !["prepared", "review"].includes(base.status) ||
          p.approve !== true
        )
          throw Error("Plan and explicit implementation approval required");
        if (!discovery(s.project.unityRoot).codex.authenticated)
          throw Error("Codex is not authenticated");
        const run = {
          ...base,
          id: id(),
          at: new Date().toISOString(),
          mode: "implement",
          status: "running",
          output: "",
          error: "",
          diff: "",
          files: [],
        };
        run.isolation = prepareImplementation(
          s.project.unityRoot,
          local,
          run.id,
          p.scope,
        );
        run.prompt = `Implement this scoped task in the isolated worktree. Only modify these exact relative paths: ${p.scope.join(", ")}. Never edit .meta files, secrets, repository settings, or files outside this worktree. Run relevant tests and report results. Do not commit.\n${base.prompt.replace("Plan only. Do not edit files or execute commands.", "")}`;
        s.runs.unshift(run);
        store.save(s);
        const child = executePlan(
          run,
          (output, error, code) => {
            const latest = store.get(),
              target = latest.runs.find((x) => x.id === run.id);
            if (target) {
              target.output = output;
              target.error = error;
              target.exit_status = code;
              if (target.status !== "cancelled") {
                try {
                  const result = captureImplementation(
                    run.isolation,
                    local,
                    run.id,
                  );
                  Object.assign(target, result);
                  target.status =
                    code === 0 ? "changes awaiting review" : "failed";
                } catch (e) {
                  target.status = "blocked";
                  target.error = e.message;
                }
              }
              event(
                latest,
                `Isolated implementation ${target.status}; project files unchanged`,
              );
              store.save(latest);
            }
            workers.delete(run.id);
          },
          updateProgress(run.id),
        );
        workers.set(run.id, child);
        send(res, 200, { status: "running" });
      } else if (url.pathname === "/api/apply") {
        const run = s.runs.find((x) => x.id === p.id);
        if (
          !run ||
          run.status !== "changes awaiting review" ||
          p.approve !== true
        )
          throw Error("Previewed changes and explicit approval required");
        if (run.diff !== readFileSync(run.patch, "utf8"))
          throw Error("Patch changed after review");
        applyImplementation(run.isolation, run.patch);
        run.status = "applied; validation pending";
        event(
          s,
          "Approved patch applied to project. Technical and gameplay validation remain pending.",
        );
        store.save(s);
        send(res, 200, s);
      } else if (url.pathname === "/api/reject-run") {
        const run = s.runs.find((x) => x.id === p.id);
        if (
          !run ||
          !run.isolation ||
          ["running", "applied; validation pending"].includes(run.status)
        )
          throw Error("Run cannot be discarded");
        discardImplementation(run.isolation);
        run.status = "rejected";
        event(s, "Rejected implementation; project files unchanged");
        store.save(s);
        send(res, 200, s);
      } else if (url.pathname === "/api/execute") {
        const run = s.runs.find((x) => x.id === p.id);
        if (!run || run.status !== "prepared" || p.approve !== true)
          throw Error("Prepared plan and explicit approval required");
        if (!discovery(s.project.unityRoot).codex.authenticated)
          throw Error(
            "Codex CLI is not authenticated. Copy the context pack into your Codex session.",
          );
        run.status = "running";
        store.save(s);
        const child = executePlan(
          run,
          (output, error, code) => {
            const latest = store.get();
            const target = latest.runs.find((x) => x.id === run.id);
            if (target) {
              target.output = output;
              target.error = error;
              target.exit_status = code;
              target.status =
                target.status === "cancelled"
                  ? "cancelled"
                  : code === 0
                    ? "review"
                    : "failed";
              event(latest, `Codex planning ${target.status}`);
              store.save(latest);
            }
            workers.delete(run.id);
          },
          updateProgress(run.id),
        );
        workers.set(run.id, child);
        send(res, 200, { status: "running" });
      } else if (url.pathname === "/api/cancel") {
        const run = s.runs.find((x) => x.id === p.id);
        if (!run) throw Error("Run not found");
        run.status = "cancelled";
        workers.get(run.id)?.kill("SIGTERM");
        store.save(s);
        send(res, 200, s);
      } else send(res, 404, { error: "Not found" });
      return;
    }
    if (url.pathname.startsWith("/media/")) {
      const dir = path.join(local, "assets");
      const file = path.resolve(dir, url.pathname.slice(7));
      if (
        !file.startsWith(dir + path.sep) ||
        !existsSync(file) ||
        !realpathSync(file).startsWith(realpathSync(dir) + path.sep)
      ) {
        send(res, 404, { error: "Asset not found" });
        return;
      }
      const mime = {
        ".glb": "model/gltf-binary",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".ogg": "audio/ogg",
      };
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(readFileSync(file));
      return;
    }
    if (vite)
      vite.middlewares(req, res, () => {
        res.writeHead(404);
        res.end();
      });
    else {
      const dir = path.join(root, "dist");
      let file = path.resolve(dir, "." + decodeURIComponent(url.pathname));
      if (file !== dir && !file.startsWith(dir + path.sep)) {
        send(res, 403, { error: "Path rejected" });
        return;
      }
      if (!existsSync(file) || url.pathname === "/")
        file = path.join(dir, "index.html");
      const mime = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".json": "application/json",
      };
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(readFileSync(file));
    }
  } catch (e) {
    send(res, 400, { error: e.message });
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Forge running at http://127.0.0.1:${port}`),
);
for (const r of store.get().runs.filter((r) => r.status === "running")) {
  const s = store.get();
  s.runs.find((x) => x.id === r.id).status = "interrupted";
  store.save(s);
}
const shutdown = () => {
  for (const child of workers.values()) child.kill();
  server.close();
  store.close();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
