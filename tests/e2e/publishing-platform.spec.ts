import { test, expect } from "@playwright/test";

test.describe("publishing platform UI", () => {
  test("publishing page renders composer and queue", async ({ page }) => {
    await page.goto("/publishing");
    await expect(page.getByRole("heading", { name: "Publishing" })).toBeVisible();
    await expect(page.getByText("Publication composer")).toBeVisible();
    await expect(page.getByText("Publication queue")).toBeVisible();
  });
});
