import { test, expect } from "@playwright/test";

test.describe("stage 5 unified analytics smoke", () => {
  test("unauthenticated user cannot access unified analytics workspace", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user cannot access analytics channels tab", async ({ page }) => {
    await page.goto("/analytics/channels");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user cannot access analytics attribution tab", async ({ page }) => {
    await page.goto("/analytics/attribution");
    await expect(page).toHaveURL(/\/login/);
  });
});
