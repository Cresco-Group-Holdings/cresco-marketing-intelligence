/**
 * Task 6.2 visual QA screenshot capture.
 * Run with ALLOW_TEST_AUTH=true and a reachable DATABASE_URL.
 */
import { test } from "@playwright/test";
import path from "node:path";

const ARTIFACTS = "/opt/cursor/artifacts/screenshots";
const VIEWPORT = { width: 1440, height: 900 };

const routes: Array<{ path: string; filename: string }> = [
  { path: "/automations", filename: "automations-overview-1440.png" },
  { path: "/automations/templates", filename: "automation-templates-1440.png" },
  { path: "/automations/history", filename: "automation-history-1440.png" },
  { path: "/operations/jobs", filename: "operations-jobs-1440.png" },
  { path: "/dashboard", filename: "command-centre-operations-priority-1440.png" },
];

test.describe("Task 6.2 visual QA screenshots", () => {
  test.skip(process.env.ALLOW_TEST_AUTH !== "true", "Requires ALLOW_TEST_AUTH");

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
  });

  for (const route of routes) {
    test(`capture ${route.filename}`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: path.join(ARTIFACTS, route.filename),
        fullPage: true,
      });
    });
  }
});
