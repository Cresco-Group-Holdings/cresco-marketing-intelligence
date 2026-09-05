import { test, expect } from "@playwright/test";
import { DEFAULT_PLAN_CATALOG } from "@/lib/billing/plan-catalog";

const testAuthEnabled = process.env.ALLOW_TEST_AUTH === "true";
const clientErrors: string[] = [];

test.describe("Golden Customer Journeys — browser certification", () => {
  test.beforeEach(async ({ page }) => {
    clientErrors.length = 0;
    page.on("pageerror", (error) => clientErrors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") clientErrors.push(msg.text());
    });
  });

  test.afterEach(() => {
    expect(clientErrors, `Unexpected client exceptions: ${clientErrors.join("; ")}`).toEqual([]);
  });

  test("Journey A — authenticated onboarding shell without preview fixtures", async ({ page }) => {
    test.skip(!testAuthEnabled, "Requires ALLOW_TEST_AUTH");

    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: "Welcome to Cresco" })).toBeVisible();
    await expect(page.locator('[data-visual-preview="true"]')).toHaveCount(0);
  });

  test("Journey D — Command Centre reachable for authenticated user", async ({ page }) => {
    test.skip(!testAuthEnabled, "Requires ALLOW_TEST_AUTH");

    await page.goto("/command-centre");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("Journey E — pricing truth matches canonical catalogue", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: "Pricing" })).toBeVisible();

    const starter = DEFAULT_PLAN_CATALOG.find((plan) => plan.key === "starter");
    expect(starter).toBeDefined();
    await expect(page.getByRole("heading", { name: starter!.displayName, exact: true })).toBeVisible();
  });

  test("Journey F — calendar remains usable when activation API returns degraded state", async ({
    page,
    context,
  }) => {
    test.skip(!testAuthEnabled, "Requires ALLOW_TEST_AUTH");

    await context.route("**/api/activation**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            status: "in_progress",
            isActivated: false,
            degradedSources: ["contentProvenance"],
            checklist: { essential: [], optional: [] },
            workspace: { organisation: null, project: null, brand: null },
          },
          meta: {},
          error: null,
        }),
      });
    });

    await context.route("**/api/dashboard/command-centre**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: { code: "INTERNAL_ERROR", message: "simulated" } }),
      });
    });

    await page.goto("/calendar");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/calendar|schedule|upcoming/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
