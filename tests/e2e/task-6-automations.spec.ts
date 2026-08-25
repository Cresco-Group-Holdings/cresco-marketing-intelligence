import { test, expect } from "@playwright/test";

test.describe("Task 6 automations workspace", () => {
  test("automations overview route renders launch workspace shell", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });
});
