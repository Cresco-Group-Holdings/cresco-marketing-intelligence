import { test, expect } from "@playwright/test";

test.describe("integrations platform UI", () => {
  test("integrations directory renders provider catalogue shell", async ({ page }) => {
    await page.goto("/integrations");
    await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
    await expect(page.getByText("Provider catalogue")).toBeVisible();
    await expect(page.getByPlaceholder("Search providers...")).toBeVisible();
  });

  test("shows no connections empty state copy", async ({ page }) => {
    await page.goto("/integrations");
    await expect(page.getByText("Active connections")).toBeVisible();
    await expect(
      page.getByText(/No active connections|No connections yet/i).first(),
    ).toBeVisible();
  });
});
