import { test, expect } from "@playwright/test";

test.describe("stage 3 paid advertising smoke", () => {
  test("unauthenticated user cannot access advertising workspace", async ({ page }) => {
    await page.goto("/advertising");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user cannot access advertising campaigns", async ({ page }) => {
    await page.goto("/advertising/campaigns");
    await expect(page).toHaveURL(/\/login/);
  });
});
