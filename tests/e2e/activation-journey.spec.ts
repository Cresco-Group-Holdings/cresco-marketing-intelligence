import { describe, expect, it } from "@playwright/test";

test.describe("activation journeys", () => {
  test("unauthenticated user is redirected from getting-started", async ({ page }) => {
    await page.goto("/getting-started");
    await expect(page).toHaveURL(/\/login/);
  });

  test("onboarding welcome screen renders for authenticated test user", async ({ page }) => {
    test.skip(process.env.ALLOW_TEST_AUTH !== "true", "Requires ALLOW_TEST_AUTH");

    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: "Welcome to Cresco" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue setup" })).toBeVisible();
  });

  test("getting-started page renders activation checklist shell", async ({ page }) => {
    test.skip(process.env.ALLOW_TEST_AUTH !== "true", "Requires ALLOW_TEST_AUTH");

    await page.goto("/getting-started");
    await expect(page.getByRole("heading", { name: "Welcome to Cresco" })).toBeVisible();
  });

  test("accept-invite page validates missing token", async ({ page }) => {
    await page.goto("/accept-invite");
    await expect(page.getByText("Invitation token is missing.")).toBeVisible();
  });
});
