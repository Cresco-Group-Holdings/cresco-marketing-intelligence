import { test, expect } from "@playwright/test";

test.describe("stage 6 copilot smoke", () => {
  test("unauthenticated user cannot access copilot workspace", async ({ page }) => {
    await page.goto("/copilot");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user cannot access copilot API", async ({ request }) => {
    const response = await request.post("/api/copilot/query", {
      data: {
        question: "Why did ROAS decline?",
        pageContext: { route: "/advertising" },
      },
    });
    expect(response.status()).toBeGreaterThanOrEqual(401);
  });
});
