import { test, expect } from "@playwright/test";

test.describe("Task 4.1 SEO crawler E2E", () => {
  test.beforeEach(() => {
    test.skip(process.env.ALLOW_TEST_AUTH !== "true", "Requires ALLOW_TEST_AUTH for authenticated flows");
  });

  test("SEO overview page loads", async ({ page }) => {
    await page.goto("/seo");
    await expect(page.getByRole("heading", { name: "Technical SEO" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sites" })).toBeVisible();
  });

  test("SEO sites list and new site form load", async ({ page }) => {
    await page.goto("/seo/sites");
    await expect(page.getByRole("heading", { name: "Technical SEO" })).toBeVisible();

    await page.goto("/seo/sites/new");
    await expect(page.getByLabel("Site name")).toBeVisible();
    await expect(page.getByLabel("Primary domain")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create site" })).toBeVisible();
  });

  test("SEO worker endpoint rejects unauthenticated requests", async ({ request }) => {
    const response = await request.post("/api/seo-crawl/process-due");
    expect(response.status()).toBe(403);
  });

  test("unauthenticated users cannot access SEO routes", async ({ page }) => {
    test.skip(process.env.ALLOW_TEST_AUTH === "true", "Only valid when test auth is disabled");

    await page.goto("/seo");
    await expect(page).toHaveURL(/\/login/);
  });
});
