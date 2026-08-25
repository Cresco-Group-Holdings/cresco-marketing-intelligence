import { test } from "@playwright/test";
import path from "node:path";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "screenshots", "content-intelligence");
const BASE = "/dev/content-intelligence-preview";

test.describe("Content Intelligence visual QA screenshots", () => {
  test("capture required content studio screenshots", async ({ page }) => {
    test.setTimeout(180_000);
    test.skip(process.env.NODE_ENV === "production", "Preview route unavailable in production");

    await page.goto(`${BASE}/overview`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
    await page.waitForTimeout(800);

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "content-studio-overview-1920.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "content-studio-overview-1440.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "content-studio-overview-1366.png"),
      fullPage: true,
    });

    await page.goto(`${BASE}/create`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-preview-tab="create"]', { timeout: 60_000 });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "content-studio-create-1440.png"),
      fullPage: true,
    });

    await page.goto(`${BASE}/strategy`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-preview-tab="strategy"]', { timeout: 60_000 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "content-studio-strategy-1440.png"),
      fullPage: true,
    });

    await page.goto(`${BASE}/performance`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-preview-tab="performance"]', { timeout: 60_000 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "content-studio-performance-1440.png"),
      fullPage: true,
    });

    await page.goto(`${BASE}/create`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Generate brief" }).click();
    await page.getByRole("button", { name: "Generate draft" }).click();
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "content-studio-brief-master-1440.png"),
      fullPage: true,
    });

    await page.goto(`${BASE}/overview`, { waitUntil: "domcontentloaded" });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "content-winning-next-recommendation-1440.png"),
      fullPage: true,
    });
  });
});
