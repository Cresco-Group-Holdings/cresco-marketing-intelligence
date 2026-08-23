import { test } from "@playwright/test";
import path from "node:path";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "screenshots", "command-centre");
const PREVIEW_URL = "/dev/command-centre-preview";

test.describe("Command Centre visual QA screenshots", () => {
  test("capture required dashboard screenshots", async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(process.env.NODE_ENV === "production", "Preview route unavailable in production");

    await page.goto(PREVIEW_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
    await page.waitForTimeout(1000);

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "dashboard-1920.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "dashboard-1440.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "dashboard-1366.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      window.localStorage.setItem("cresco-sidebar-collapsed", "true");
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "dashboard-sidebar-collapsed.png"),
      fullPage: true,
    });

    await page.evaluate(() => {
      window.localStorage.setItem("cresco-sidebar-collapsed", "false");
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
    await page.getByRole("button", { name: /marketing health/i }).click();
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "dashboard-health-expanded.png"),
      fullPage: true,
    });
  });
});
