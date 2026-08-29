import { test } from "@playwright/test";
import path from "node:path";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "screenshots", "security");
const PREVIEW_BASE = "/dev/security-preview";

const SCREENSHOTS: Array<{ tab: string; filename: string }> = [
  { tab: "overview", filename: "security-settings-1440.png" },
  { tab: "sessions", filename: "active-sessions-1440.png" },
  { tab: "audit-log", filename: "audit-log-1440.png" },
  { tab: "permission-denied", filename: "permission-denied-1440.png" },
  { tab: "provider-reauth", filename: "provider-reauth-security-1440.png" },
  { tab: "operations-failure", filename: "operations-failure-1440.png" },
  { tab: "billing-security", filename: "billing-payment-security-state-1440.png" },
  { tab: "privacy", filename: "privacy-data-controls-1440.png" },
];

test.describe("Security visual QA screenshots", () => {
  test("capture required security screenshots", async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(process.env.NODE_ENV === "production", "Preview route unavailable in production");

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${PREVIEW_BASE}/overview`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "security-settings-1920.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "security-settings-1366.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    for (const { tab, filename } of SCREENSHOTS) {
      await page.goto(`${PREVIEW_BASE}/${tab}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUTPUT_DIR, filename), fullPage: true });
    }
  });
});
