import { test, expect } from "@playwright/test";

const PREVIEW_BASE = "/dev/analytics-preview";

test.describe("analytics attribution launch gate", () => {
  test("dev preview exposes attributed revenue semantics and launch models", async ({ page }) => {
    test.skip(process.env.NODE_ENV === "production", "Preview route unavailable in production");

    await page.goto(`${PREVIEW_BASE}/overview`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });

    await expect(page.getByText("Attributed Revenue").first()).toBeVisible();
    await expect(page.getByText("Revenue Influenced")).toHaveCount(0);

    await page.goto(`${PREVIEW_BASE}/revenue`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
    await expect(page.getByText("Observed revenue").first()).toBeVisible();
    await expect(page.getByText("Attributed revenue").first()).toBeVisible();
    await expect(page.getByText("Unattributed / outside coverage").first()).toBeVisible();
  });

  test("attribution tab keeps advanced models out of launch preview fixture", async ({ page }) => {
    test.skip(process.env.NODE_ENV === "production", "Preview route unavailable in production");

    await page.goto(`${PREVIEW_BASE}/attribution`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });

    const modelSelect = page.getByLabel("Attribution model");
    await expect(modelSelect).toBeVisible();
    await expect(modelSelect.locator("option")).toHaveCount(3);
    await expect(page.getByText("Position-based")).toHaveCount(0);
    await expect(page.getByText("Time decay")).toHaveCount(0);
  });
});

test.describe("analytics auth gate", () => {
  test("unauthenticated user cannot access unified analytics workspace", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page).toHaveURL(/\/login/);
  });
});
