import { test, expect } from "@playwright/test";

test.describe("workspace smoke tests", () => {
  test.use({
    extraHTTPHeaders: process.env.ALLOW_TEST_AUTH === "true" ? {} : undefined,
  });

  test("onboarding page loads for authenticated test user", async ({ page }) => {
    test.skip(process.env.ALLOW_TEST_AUTH !== "true", "Requires ALLOW_TEST_AUTH");

    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: "Set up your workspace" })).toBeVisible();
  });

  test("brands page loads", async ({ page }) => {
    test.skip(process.env.ALLOW_TEST_AUTH !== "true", "Requires ALLOW_TEST_AUTH");

    await page.goto("/brands");
    await expect(page.getByRole("heading", { name: "Brands" })).toBeVisible();
  });
});
