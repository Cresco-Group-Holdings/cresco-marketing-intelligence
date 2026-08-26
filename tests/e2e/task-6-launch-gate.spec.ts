import { test, expect } from "@playwright/test";

test.describe("Task 6 launch gate journeys", () => {
  test("operations jobs route requires authentication", async ({ page }) => {
    await page.goto("/operations/jobs");
    await expect(page).toHaveURL(/\/login/);
  });

  test("automations workspace routes require authentication", async ({ page }) => {
    await page.goto("/automations");
    await expect(page).toHaveURL(/\/login/);
  });

  test("automations templates route requires authentication", async ({ page }) => {
    await page.goto("/automations/templates");
    await expect(page).toHaveURL(/\/login/);
  });

  test("authenticated user can open automations workspace", async ({ page }) => {
    test.skip(process.env.ALLOW_TEST_AUTH !== "true", "Requires ALLOW_TEST_AUTH");

    await page.goto("/automations");
    await expect(page.getByRole("heading", { name: /automations/i })).toBeVisible();
  });

  test("authenticated user can open operations jobs", async ({ page }) => {
    test.skip(process.env.ALLOW_TEST_AUTH !== "true", "Requires ALLOW_TEST_AUTH");

    await page.goto("/operations/jobs");
    await expect(page.getByRole("heading", { name: /background jobs/i })).toBeVisible();
  });
});
