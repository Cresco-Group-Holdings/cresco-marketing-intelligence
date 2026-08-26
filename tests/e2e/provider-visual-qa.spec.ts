/**
 * Task 4.1 visual QA screenshot capture.
 * Run with ALLOW_TEST_AUTH=true and a reachable DATABASE_URL.
 */
import { test } from "@playwright/test";
import path from "node:path";

const ARTIFACTS = "/opt/cursor/artifacts/screenshots";
const VIEWPORT = { width: 1440, height: 900 };

const routes: Array<{ path: string; filename: string }> = [
  { path: "/integrations", filename: "integrations-connected-1440.png" },
  { path: "/integrations", filename: "integrations-available-1440.png" },
  { path: "/organic-social/accounts", filename: "organic-accounts-connected-1440.png" },
  { path: "/organic-social/publishing", filename: "publishing-connected-accounts-1440.png" },
];

test.describe("Task 4.1 visual QA screenshots", () => {
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
