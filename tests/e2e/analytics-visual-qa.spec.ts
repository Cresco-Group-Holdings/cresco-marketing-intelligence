import { test } from "@playwright/test";
import path from "node:path";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "screenshots", "analytics");
const PREVIEW_BASE = "/dev/analytics-preview";

test.describe("Unified Analytics visual QA screenshots", () => {
  test("capture required analytics screenshots", async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(process.env.NODE_ENV === "production", "Preview route unavailable in production");

    await page.goto(`${PREVIEW_BASE}/overview`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
    await page.waitForTimeout(1000);

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "overview-1920.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "overview-1440.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "overview-1366.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [tab, filename] of [
      ["attribution", "attribution-1440.png"],
      ["revenue", "revenue-1440.png"],
      ["content", "content-1440.png"],
      ["partial", "partial-data-1440.png"],
    ] as const) {
      await page.goto(`${PREVIEW_BASE}/${tab}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(OUTPUT_DIR, filename),
        fullPage: true,
      });
    }

    await page.goto(`${PREVIEW_BASE}/attribution`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "attribution-coverage-warning-1440.png"),
      fullPage: true,
    });
  });
});
