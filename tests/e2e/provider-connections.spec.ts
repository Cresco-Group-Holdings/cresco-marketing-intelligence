import { test, expect } from "@playwright/test";

test.describe("provider connections UI", () => {
  test("integrations page groups providers by availability", async ({ page }) => {
    await page.goto("/integrations");
    await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
    await expect(page.getByText("Available to connect")).toBeVisible();
    await expect(page.getByText("Connect first account")).toBeVisible();
  });

  test("shows marketing accounts empty state copy", async ({ page }) => {
    await page.goto("/integrations");
    await expect(
      page.getByText(/No marketing accounts connected|marketing data into Cresco/i).first(),
    ).toBeVisible();
  });
});
