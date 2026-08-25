import { test } from "@playwright/test";
import path from "node:path";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "screenshots", "onboarding");

const SCENES = [
  { scene: "welcome", filename: "onboarding-welcome-1440.png" },
  { scene: "brand", filename: "onboarding-brand-1440.png" },
  { scene: "brand-knowledge", filename: "onboarding-brand-knowledge-1440.png" },
  { scene: "integrations", filename: "onboarding-integrations-1440.png" },
  { scene: "sync", filename: "onboarding-sync-1440.png" },
  { scene: "first-content", filename: "onboarding-first-content-1440.png" },
  { scene: "success", filename: "onboarding-success-1440.png" },
  { scene: "command-centre-checklist", filename: "command-centre-activation-checklist-1440.png" },
  { scene: "demo-entry", filename: "demo-workspace-entry-1440.png" },
  { scene: "requires-admin", filename: "onboarding-requires-admin-1440.png" },
] as const;

test.describe("onboarding visual QA screenshots", () => {
  test("capture required onboarding screenshots", async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(process.env.NODE_ENV === "production", "Preview route unavailable in production");

    await page.setViewportSize({ width: 1440, height: 900 });

    for (const { scene, filename } of SCENES) {
      await page.goto(`/dev/onboarding-preview/${scene}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(OUTPUT_DIR, filename),
        fullPage: true,
      });
    }

    for (const size of [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
    ]) {
      await page.setViewportSize(size);
      await page.goto("/dev/onboarding-preview/welcome", { waitUntil: "domcontentloaded" });
      await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
      await page.screenshot({
        path: path.join(OUTPUT_DIR, `onboarding-welcome-${size.width}.png`),
        fullPage: true,
      });
    }
  });
});
