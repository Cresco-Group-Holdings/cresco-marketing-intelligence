import { test } from "@playwright/test";
import path from "node:path";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "screenshots", "organic-growth");
const COMMAND_CENTRE_OUTPUT = path.join(process.cwd(), "artifacts", "screenshots", "command-centre");
const PREVIEW_OVERVIEW = "/dev/organic-growth-preview";
const PREVIEW_GROWTH = "/dev/organic-growth-preview/growth";
const PREVIEW_ACCOUNTS = "/dev/organic-growth-preview/accounts";
const PREVIEW_PUBLISHING = "/dev/organic-growth-preview/publishing";

test.describe("Organic Growth visual QA screenshots", () => {
  test("capture required organic workspace screenshots", async ({ page }) => {
    test.setTimeout(180_000);
    test.skip(process.env.NODE_ENV === "production", "Preview route unavailable in production");

    await page.goto(PREVIEW_OVERVIEW, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
    await page.waitForTimeout(1000);

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "organic-overview-1920.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "organic-overview-1440.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "organic-overview-1366.png"),
      fullPage: true,
    });

    await page.goto(PREVIEW_GROWTH, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
    await page.waitForSelector('[data-preview-tab="growth"]', { timeout: 60_000 });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "organic-growth-1440.png"),
      fullPage: true,
    });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "organic-winning-content-1440.png"),
      fullPage: true,
    });

    await page.goto(PREVIEW_ACCOUNTS, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-preview-tab="accounts"]', { timeout: 60_000 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "organic-accounts-1440.png"),
      fullPage: true,
    });

    await page.goto(PREVIEW_PUBLISHING, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-preview-tab="publishing"]', { timeout: 60_000 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "organic-publishing-1440.png"),
      fullPage: true,
    });

    await page.goto("/dev/command-centre-preview", { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
    await page.getByRole("tab", { name: "Organic" }).click();
    await page.screenshot({
      path: path.join(COMMAND_CENTRE_OUTPUT, "command-centre-organic-1440.png"),
      fullPage: true,
    });
  });
});
