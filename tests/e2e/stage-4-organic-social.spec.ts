import { test, expect } from "@playwright/test";

test.describe("stage 4 organic social smoke", () => {
  test("unauthenticated user cannot access organic social workspace", async ({ page }) => {
    await page.goto("/social");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user cannot access reels workspace", async ({ page }) => {
    await page.goto("/social/reels");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user cannot access organic performance", async ({ page }) => {
    await page.goto("/social/performance");
    await expect(page).toHaveURL(/\/login/);
  });
});
