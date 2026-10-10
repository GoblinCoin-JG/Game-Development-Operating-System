import { createHash } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { validate } from "./store.js";
import { validateGLB } from "./assets.js";
const limit = 96 * 1024 * 1024;
const digest = (value) => createHash("sha256").update(value).digest("hex");
export function disableImportedRuns(state) {
  return {
    ...state,
    runs: state.runs.map(({ isolation, patch, ...run }) => ({
      ...run,
      status: "imported · execution disabled",
    })),
  };
}
export function exportBundle(store) {
  const state = store.get();
  const checkpoints = store.db
    .prepare("SELECT id,data,at FROM snapshots ORDER BY id")
    .all()
    .map((row) => ({ ...row, data: JSON.parse(row.data) }));
  const files = [];
  let size = 0;
  for (const dir of ["assets", "run-artifacts"]) {
    const base = path.join(store.root, dir);
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base)) {
      const file = path.join(base, name);
      if (!realpathSync(file).startsWith(realpathSync(base) + path.sep))
        throw Error("Cannot back up escaping symlink");
      const bytes = readFileSync(file);
      size += bytes.length;
      if (size > limit)
        throw Error("Bundle exceeds 96 MB; use a full-directory backup");
      files.push({
        path: `${dir}/${name}`,
        sha256: digest(bytes),
        base64: bytes.toString("base64"),
      });
    }
  }
  const bundle = {
    format: "forge-bundle",
    version: 1,
    created_at: new Date().toISOString(),
    state,
    checkpoints,
    files,
  };
  const json = JSON.stringify(bundle);
  if (Buffer.byteLength(json) > 150 * 1024 * 1024)
    throw Error(
      "Bundle with history exceeds 150 MB; use a full-directory backup",
    );
  return { ...bundle, manifest_sha256: digest(json) };
}
export function verifyBundle(input) {
  if (
    !input ||
    input.format !== "forge-bundle" ||
    input.version !== 1 ||
    !Array.isArray(input.files) ||
    !Array.isArray(input.checkpoints)
  )
    throw Error("Unsupported backup bundle");
  const { manifest_sha256, ...bundle } = input;
  if (digest(JSON.stringify(bundle)) !== manifest_sha256)
    throw Error("Backup manifest checksum mismatch");
  validate(bundle.state);
  for (const checkpoint of bundle.checkpoints) {
    if (
      !Number.isInteger(checkpoint.id) ||
      checkpoint.id < 1 ||
      typeof checkpoint.at !== "string"
    )
      throw Error("Invalid checkpoint");
    validate(checkpoint.data);
  }
  const names = new Set();
  let total = 0;
  const decoded = [];
  for (const file of bundle.files) {
    if (
      !/^(assets\/[a-zA-Z0-9_-]+\.(glb|png|jpg|jpeg|webp|wav|mp3|ogg)|run-artifacts\/[a-zA-Z0-9_-]+\.patch)$/.test(
        file.path,
      ) ||
      names.has(file.path)
    )
      throw Error("Unsafe or duplicate backup path");
    names.add(file.path);
    if (
      typeof file.base64 !== "string" ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64) ||
      file.base64.length % 4 !== 0
    )
      throw Error("Invalid file encoding");
    const bytes = Buffer.from(file.base64, "base64");
    if (bytes.toString("base64") !== file.base64)
      throw Error("Invalid file encoding");
    total += bytes.length;
    if (total > limit) throw Error("Bundle exceeds 96 MB");
    if (digest(bytes) !== file.sha256)
      throw Error("Backup file checksum mismatch");
    if (file.path.endsWith(".glb")) validateGLB(bytes);
    decoded.push({ ...file, bytes });
  }
  for (const state of [bundle.state, ...bundle.checkpoints.map((x) => x.data)])
    for (const record of state.records)
      for (const rev of record.revisions || [])
        if (!names.has("assets/" + rev.source_path.slice(7)))
          throw Error("Bundle is missing referenced media");
  return { ...bundle, decoded };
}
export function restoreBundle(store, input) {
  const bundle = verifyBundle(input);
  const previous = store.get();
  const files = bundle.decoded.map((file) => ({
    ...file,
    destination: path.join(store.root, file.path),
  }));
  for (const file of files)
    if (existsSync(file.destination)) {
      const parent = realpathSync(path.dirname(file.destination));
      if (
        !parent.startsWith(realpathSync(store.root) + path.sep) ||
        realpathSync(file.destination) !== file.destination
      )
        throw Error("Unsafe restore destination");
      if (digest(readFileSync(file.destination)) !== file.sha256)
        throw Error("Existing file differs; restore into a new data directory");
    }
  const recovery = exportBundle(store);
  const recoveryDir = path.join(store.root, "recovery");
  mkdirSync(recoveryDir, { recursive: true });
  writeFileSync(
    path.join(recoveryDir, `before-restore-${Date.now()}.json`),
    JSON.stringify(recovery),
  );
  const created = [];
  try {
    for (const file of files) {
      if (existsSync(file.destination)) continue;
      mkdirSync(path.dirname(file.destination), { recursive: true });
      if (
        !realpathSync(path.dirname(file.destination)).startsWith(
          realpathSync(store.root) + path.sep,
        )
      )
        throw Error("Unsafe restore destination");
      writeFileSync(file.destination, file.bytes, { flag: "wx" });
      created.push(file.destination);
    }
    store.db.exec("BEGIN IMMEDIATE");
    try {
      store.db.exec("DELETE FROM snapshots");
      for (const row of bundle.checkpoints)
        store.db
          .prepare("INSERT INTO snapshots(id,data,at) VALUES(?,?,?)")
          .run(row.id, JSON.stringify(disableImportedRuns(row.data)), row.at);
      store.db
        .prepare("INSERT INTO snapshots(data,at) VALUES(?,?)")
        .run(JSON.stringify(previous), new Date().toISOString());
      store.db
        .prepare("UPDATE state SET data=? WHERE id=1")
        .run(JSON.stringify(disableImportedRuns(bundle.state)));
      store.db.exec("COMMIT");
    } catch (e) {
      store.db.exec("ROLLBACK");
      throw e;
    }
  } catch (e) {
    for (const file of created) unlinkSync(file);
    throw e;
  }
  store.exportCanonical(store.get());
  return {
    state: store.get(),
    files_restored: files.length,
    checkpoints_restored: bundle.checkpoints.length,
  };
}
