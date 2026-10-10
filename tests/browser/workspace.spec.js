import { test, expect } from "@playwright/test";
import { seed } from "../../server/seed.js";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".page-heading");
  await page.evaluate(async (data) => {
    const { token } = await fetch("/api/session").then((r) => r.json());
    await fetch("/api/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forge-Token": token },
      body: JSON.stringify({ data, confirm: true }),
    });
  }, seed());
  await page.reload();
  await page.waitForSelector(".page-heading");
});
const nav = async (page, name) =>
  page
    .locator(".sidebar nav")
    .getByRole("button", { name, exact: true })
    .click();
test("overview renders a real 3D viewport and every navigation view works without console errors", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(
    page.getByRole("heading", { name: "Let’s build something worth playing." }),
  ).toBeVisible();
  await expect(page.locator(".canvas canvas")).toBeVisible();
  for (const name of [
    "Project explorer",
    "Work board",
    "Asset studio",
    "Knowledge graph",
    "Inbox & review",
    "Playtests",
  ]) {
    await nav(page, name);
    await expect(page.locator(".page-heading")).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test("custom types require approval then support creating and editing records", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Add custom type and section", exact: true })
    .click();
  await page.getByLabel("Entity type name").fill("Faction");
  await page.getByLabel("Explorer section", { exact: true }).fill("Factions");
  await page
    .getByLabel("Form fields (comma separated)")
    .fill("Ideology, Territory");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(
    page.locator(".tree-heading").filter({ hasText: "Factions" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(
    page.locator(".tree-heading").filter({ hasText: "Factions" }),
  ).toBeVisible();
  await nav(page, "Project explorer");
  await page.getByRole("button", { name: "New record", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("The Lantern Guild");
  await page
    .getByLabel("Entity type", { exact: true })
    .selectOption({ label: "Faction" });
  await page
    .getByLabel("Project section", { exact: true })
    .selectOption({ label: "Factions" });
  await page
    .getByLabel("Canonical specification")
    .fill("An unresolved faction concept.");
  await page
    .getByLabel("Ideology", { exact: true })
    .fill("Shared salvage rights");
  await page.getByRole("button", { name: "Save to workspace" }).click();
  await page
    .locator(".record-row")
    .filter({ hasText: "The Lantern Guild" })
    .click();
  await expect(page.locator(".inspector h2")).toHaveText("The Lantern Guild");
  await page.reload();
  await nav(page, "Project explorer");
  await expect(
    page.locator(".record-row").filter({ hasText: "The Lantern Guild" }),
  ).toBeVisible();
});
test("comments remain linked in inbox and context preparation does not claim AI execution", async ({
  page,
}) => {
  await nav(page, "Project explorer");
  await page
    .locator(".record-row")
    .filter({ hasText: "Wormhole event window" })
    .click();
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await page
    .getByLabel("Request, question, or feedback")
    .fill("Change the event window to fifteen minutes.");
  await page.getByRole("button", { name: "Save to workspace" }).click();
  await expect(
    page
      .getByText("Change the event window to fifteen minutes.", { exact: true })
      .first(),
  ).toBeVisible();
  await page
    .locator(".review-grid")
    .getByRole("button", { name: "Prepare plan", exact: true })
    .click();
  await expect(page.locator(".run-card")).toContainText("prepared");
  await expect(page.locator(".run-card")).toContainText("cited sources");
  await expect(page.locator(".run-card")).toContainText("deterministic");
});
test("evidence gates technical verification while human validation remains separate", async ({
  page,
}) => {
  await nav(page, "Project explorer");
  await page
    .locator(".record-row")
    .filter({ hasText: "Prototype the extraction countdown" })
    .click();
  await page
    .getByLabel("Build status", { exact: true })
    .selectOption("verified");
  await expect(page.getByRole("status")).toContainText(
    "requires passing technical evidence",
  );
  await page
    .getByRole("button", { name: "Record evidence", exact: true })
    .click();
  await page
    .getByLabel("What was verified?")
    .fill("Countdown unit tests passed");
  await page
    .getByLabel("Traceable log, test report, file, or screenshot reference")
    .fill("tests/countdown.xml");
  await page.getByRole("button", { name: "Save to workspace" }).click();
  await page
    .getByLabel("Build status", { exact: true })
    .selectOption("verified");
  await expect(page.getByLabel("Build status", { exact: true })).toHaveValue(
    "verified",
  );
  await expect(page.getByLabel("Gameplay status", { exact: true })).toHaveValue(
    "not tested",
  );
});
test("merge review preserves redirects and checkpoint undo restores original records", async ({
  page,
}) => {
  await nav(page, "Project explorer");
  await page
    .getByRole("button", { name: "Find overlapping designs", exact: true })
    .click();
  await page.getByRole("button", { name: "Choose records manually" }).click();
  await page
    .getByLabel("Source record (will redirect)")
    .selectOption("wormhole");
  await page.getByLabel("Canonical destination").selectOption("loop");
  await page
    .getByLabel("Surviving specification")
    .fill("Extract before the reviewed event window closes.");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.locator(".merge-diff")).toContainText(
    "Proposed event duration",
  );
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await nav(page, "Project explorer");
  await expect(
    page.locator(".record-row").filter({ hasText: "Wormhole event window" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Undo last mutation" }).click();
  await page
    .getByRole("button", { name: "Restore checkpoint", exact: true })
    .click();
  await nav(page, "Project explorer");
  await expect(
    page.locator(".record-row").filter({ hasText: "Wormhole event window" }),
  ).toBeVisible();
});
test("unknown game bootstrap is editable, approved explicitly, and generates unresolved specs", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Create a workspace", exact: true })
    .click();
  await page.getByLabel("Game name", { exact: true }).fill("Garden Sonata");
  await page
    .getByLabel("Premise, primary loop, genre, constraints & uncertainties")
    .fill(
      "Compose songs by planting flowers. A relaxing music game for desktop.",
    );
  await page
    .getByLabel("Project-specific sections (comma separated)")
    .fill("Melodies, Gardens, Performances");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.locator(".project-switch")).toContainText("Scavengers Pit");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.locator(".project-switch")).toContainText("Garden Sonata");
  await nav(page, "Project explorer");
  await expect(
    page.locator(".record-row").filter({ hasText: "Define melodies" }),
  ).toBeVisible();
});
test("phone layout has no horizontal overflow and supports navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".page-heading")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page
    .locator(".activitybar")
    .getByRole("button", { name: "Asset studio", exact: true })
    .click();
  await expect(page.locator(".page-heading h1")).toHaveText("Asset studio");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "docs/mobile-preview.png", fullPage: true });
});
test("security rejects missing token, foreign origins and unsupported asset uploads", async ({
  request,
}) => {
  expect((await request.get("/api/state")).status()).toBe(401);
  const { token } = await (await request.get("/api/session")).json();
  expect(
    (
      await request.post("/api/undo", {
        headers: { "X-Forge-Token": token, Origin: "https://example.com" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/upload", {
        headers: { "X-Forge-Token": token },
        data: { name: "model.fbx", base64: "aaaa" },
      })
    ).status(),
  ).toBe(400);
});
test("uploaded GLB renders and revisions persist with independent integration state", async ({
  page,
}) => {
  const { GLTFExporter } =
    await import("three/addons/exporters/GLTFExporter.js");
  const THREE = await import("three");
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x997766 }),
  );
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((b) => {
        this.result = b;
        this.onloadend?.();
      });
    }
  };
  const result = await new GLTFExporter().parseAsync(mesh, { binary: true });
  await nav(page, "Asset studio");
  await page.locator("input[type=file]").setInputFiles({
    name: "test-proxy.glb",
    mimeType: "model/gltf-binary",
    buffer: Buffer.from(result),
  });
  await expect(
    page.getByText("Revision 1 · GLB", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".viewer .viewport-label")).toContainText(
    "ASSET PREVIEW",
  );
  await expect(page.locator(".viewer-error")).toHaveCount(0);
  await page.reload();
  await nav(page, "Asset studio");
  await expect(
    page.getByText("Revision 1 · GLB", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".asset-info")).toContainText("Build: Not started");
});
test("section views use safe configurable renderers and survive approval", async ({
  page,
}) => {
  await nav(page, "Project explorer");
  await page.getByRole("button", { name: "Save configured view" }).click();
  await page.getByLabel("View name").fill("Systems reference");
  await page.getByLabel("Safe renderer").selectOption("document");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await nav(page, "Project explorer");
  await page
    .getByRole("button", { name: "Systems reference", exact: true })
    .click();
  await expect(page.locator(".record-documents")).toContainText(
    "Wormhole event window",
  );
  await page.getByRole("button", { name: "Gallery", exact: true }).click();
  await expect(page.locator(".record-gallery")).toBeVisible();
});
test("change impact follows the extraction dependency chain", async ({
  page,
}) => {
  await nav(page, "Project explorer");
  await page
    .locator(".record-row")
    .filter({ hasText: "Scavenge. Survive. Extract." })
    .click();
  await page.getByRole("button", { name: "Analyze change impact" }).click();
  const dialog = page.getByRole("dialog", { name: "Review change impact" });
  await expect(dialog).toContainText("Wormhole event window");
  await expect(dialog).toContainText("Playtest the first extraction loop");
  await expect(dialog).toContainText(
    "Unindexed engine/code relationships may be missing",
  );
});
test("complete backup download restores workspace state through an approval dialog", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("button", { name: "Export complete backup", exact: true })
      .click(),
  ]);
  const path = await download.path();
  await page.evaluate(async () => {
    const { token } = await fetch("/api/session").then((r) => r.json());
    await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forge-Token": token },
      body: JSON.stringify({
        op: "update",
        payload: { id: "wormhole", title: "Changed window" },
      }),
    });
  });
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .locator("label")
    .filter({ hasText: "Restore backup" })
    .locator("input[type=file]")
    .setInputFiles(path);
  await expect(page.getByRole("dialog")).toContainText("Scavengers Pit");
  await page.getByRole("button", { name: "Approve restoration" }).click();
  await nav(page, "Project explorer");
  await expect(
    page.locator(".record-row").filter({ hasText: "Wormhole event window" }),
  ).toBeVisible();
});
test("Unity report intake keeps a failed technical result independent from gameplay", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .locator("label")
    .filter({ hasText: "Import Unity test report" })
    .locator("input")
    .setInputFiles({
      name: "timer-results.xml",
      mimeType: "application/xml",
      buffer: Buffer.from(
        '<test-run total="2" passed="1" failed="1" skipped="0" result="Failed"><test-case fullname="Timer.Timeout" result="Failed"/></test-run>',
      ),
    });
  await expect(page.getByRole("dialog")).toContainText("1/2 passed");
  await page.getByLabel("Tested entity").selectOption("task-timer");
  await page.getByRole("button", { name: "Save to workspace" }).click();
  await nav(page, "Project explorer");
  await page
    .locator(".record-row")
    .filter({ hasText: "Prototype the extraction countdown" })
    .click();
  await expect(page.locator(".evidence-note")).toContainText(
    "technical · failed",
  );
  await expect(page.getByLabel("Gameplay status", { exact: true })).toHaveValue(
    "not tested",
  );
});
test("AI bootstrap preparation records a request without replacing the workspace or invoking a provider", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Create a workspace", exact: true })
    .click();
  await page.getByLabel("Game name", { exact: true }).fill("Garden Sonata");
  await page
    .getByLabel("Premise, primary loop, genre, constraints & uncertainties")
    .fill("Build melodies with flowering plants.");
  await page.getByRole("button", { name: "Prepare AI blueprint plan" }).click();
  await expect(page.locator(".run-card")).toContainText(
    "Blueprint: Garden Sonata",
  );
  await expect(page.locator(".run-card")).toContainText("prepared");
  await expect(page.locator(".project-switch")).toContainText("Scavengers Pit");
});
test("pin and dismiss suggestions are persisted without deleting the work item", async ({
  page,
}) => {
  await nav(page, "Project explorer");
  await page
    .locator(".record-row")
    .filter({ hasText: "Decide the backpack capacity" })
    .click();
  await page
    .getByRole("button", { name: "Pin next action", exact: true })
    .click();
  await nav(page, "Overview");
  await expect(page.locator(".recommended h3")).toHaveText(
    "Decide the backpack capacity",
  );
  await page
    .getByRole("button", { name: "Dismiss suggestion", exact: true })
    .click();
  await page
    .getByLabel("Reason to dismiss this suggestion")
    .fill("Focus on extraction timer");
  await page.getByRole("button", { name: "Save to workspace" }).click();
  await expect(page.locator(".recommended h3")).toHaveText(
    "Prototype the extraction countdown",
  );
  await nav(page, "Work board");
  await expect(
    page
      .locator(".task-card")
      .filter({ hasText: "Decide the backpack capacity" }),
  ).toBeVisible();
});
