import { test } from "@playwright/test";

const SCREENSHOTS = [
  { path: "/opt/cursor/artifacts/screenshots/website-home-1440.png", url: "/" },
  { path: "/opt/cursor/artifacts/screenshots/website-product-1440.png", url: "/product" },
  { path: "/opt/cursor/artifacts/screenshots/website-pricing-1440.png", url: "/pricing" },
] as const;

test.describe("launch website screenshots", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const shot of SCREENSHOTS) {
    test(`capture ${shot.url}`, async ({ page }) => {
      await page.goto(shot.url);
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: shot.path, fullPage: true });
    });
  }

  test("capture mobile home", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: "/opt/cursor/artifacts/screenshots/website-mobile-home.png",
      fullPage: true,
    });
  });
});
