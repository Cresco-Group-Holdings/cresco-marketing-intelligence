import { test, expect } from "@playwright/test";

test.describe("onboarding flows", () => {
  test("unauthenticated user is redirected from onboarding", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/login/);
  });

  test("onboarding page renders eight-step wizard for authenticated test user", async ({ page }) => {
    test.skip(process.env.ALLOW_TEST_AUTH !== "true", "Requires ALLOW_TEST_AUTH");

    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: "Set up your workspace" })).toBeVisible();
    await expect(page.getByText("Account profile")).toBeVisible();
    await expect(page.getByText("Review and completion")).toBeVisible();
  });
});
