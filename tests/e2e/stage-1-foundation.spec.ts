import { test, expect } from "@playwright/test";

test.describe("Stage 1 foundation scenario", () => {
  test.beforeEach(() => {
    test.skip(process.env.ALLOW_TEST_AUTH !== "true", "Requires ALLOW_TEST_AUTH for authenticated flows");
  });

  test("dashboard shows foundation readiness without fabricated metrics", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByText("Foundation readiness")).toBeVisible();
    await expect(page.getByText("Configuration summary")).toBeVisible();
    await expect(page.getByText(/traffic|revenue|ROI/i)).toHaveCount(0);
  });

  test("integrations catalogue shows provider connections", async ({ page }) => {
    await page.goto("/integrations");
    await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
  });

  test("brands and knowledge navigation are available", async ({ page }) => {
    await page.goto("/brands");
    await expect(page.getByRole("heading", { name: "Brands" })).toBeVisible();

    await page.goto("/knowledge");
    await expect(
      page.getByRole("heading", { name: /Knowledge Base|Select a brand|Opening knowledge base/i }),
    ).toBeVisible();
  });

  test("health and readiness endpoints respond", async ({ request }) => {
    const health = await request.get("/api/health");
    expect(health.ok()).toBeTruthy();
    const healthBody = await health.json();
    expect(healthBody.data.status).toBe("ok");

    const readiness = await request.get("/api/readiness");
    const readinessBody = await readiness.json();
    expect(readinessBody.data.checks).toBeDefined();
    expect(JSON.stringify(readinessBody)).not.toMatch(/ENCRYPTION_KEY|service-role/i);
  });

  test("unauthenticated users cannot access protected workspace routes", async ({ page }) => {
    test.skip(process.env.ALLOW_TEST_AUTH === "true", "Only valid when test auth is disabled");

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
