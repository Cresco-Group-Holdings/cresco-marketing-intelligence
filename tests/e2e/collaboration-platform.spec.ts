import { test, expect } from "@playwright/test";

test.describe("collaboration platform UI", () => {
  test("notifications page renders inbox sections", async ({ page }) => {
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: "Notifications & Inbox" })).toBeVisible();
    await expect(page.getByText("Assigned to me")).toBeVisible();
    await expect(page.getByText("Approvals")).toBeVisible();
  });
});
