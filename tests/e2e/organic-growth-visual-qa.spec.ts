import { test } from "@playwright/test";
import path from "node:path";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "screenshots", "organic-growth");
const PREVIEW_OVERVIEW = "/dev/organic-growth-preview";
const PREVIEW_GROWTH = "/dev/organic-growth-preview/growth";
const PREVIEW_ACCOUNTS = "/dev/organic-growth-preview/accounts";
const PREVIEW_PUBLISHING = "/dev/organic-growth-preview/publishing";

async function captureScreenshots(
  page: import("@playwright/test").Page,
  baseName: string,
) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.screenshot({
    path: path.join(OUTPUT_DIR, `${baseName}-1920.png`),
    fullPage: true,
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: path.join(OUTPUT_DIR, `${baseName}-1440.png`),
    fullPage: true,
  });

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.screenshot({
    path: path.join(OUTPUT_DIR, `${baseName}-1366.png`),
    fullPage: true,
  });
}

test.describe("Organic Growth visual QA screenshots", () => {
  test("capture required organic workspace screenshots", async ({ page }) => {
    test.setTimeout(180_000);
    test.skip(process.env.NODE_ENV === "production", "Preview route unavailable in production");

    await page.goto(PREVIEW_OVERVIEW, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
    await page.waitForTimeout(1000);
    await captureScreenshots(page, "overview");

    await page.goto(PREVIEW_GROWTH, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
    await page.waitForTimeout(500);
    await captureScreenshots(page, "growth");

    await page.goto(PREVIEW_ACCOUNTS, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
    await page.waitForTimeout(500);
    await captureScreenshots(page, "accounts");

    await page.goto(PREVIEW_PUBLISHING, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
    await page.waitForTimeout(500);
    await captureScreenshots(page, "publishing");

    await page.goto(PREVIEW_GROWTH, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
    await page.waitForTimeout(500);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "winning-content-opportunity-1440.png"),
      fullPage: true,
    });
  });
});
