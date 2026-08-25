import { test, expect } from "@playwright/test";

test.describe("onboarding flows", () => {
  test("unauthenticated user is redirected from onboarding", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/login/);
  });

  test("onboarding page renders welcome experience for authenticated test user", async ({ page }) => {
    test.skip(process.env.ALLOW_TEST_AUTH !== "true", "Requires ALLOW_TEST_AUTH");

    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: "Welcome to Cresco" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue setup" })).toBeVisible();
  });
});
