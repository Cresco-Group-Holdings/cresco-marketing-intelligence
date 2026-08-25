import { test, expect } from "@playwright/test";
import path from "node:path";

const SCREENSHOT_DIR = path.join(process.cwd(), "artifacts", "screenshots", "billing");

test.describe("Billing launch gate journeys", () => {
  test.beforeEach(() => {
    test.skip(process.env.NODE_ENV === "production", "Billing preview routes unavailable in production");
  });

  test("Journey A — pricing to active subscription UI", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: /plans that grow/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Starter" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pro" })).toBeVisible();
    await expect(page.getByRole("link", { name: /start with starter/i })).toBeVisible();

    await page.goto("/dev/billing-preview?state=current-plan");
    await expect(page.getByTestId("billing-current-plan-card")).toBeVisible();
    await expect(page.getByTestId("billing-current-plan-card").getByText("Pro", { exact: true })).toBeVisible();
    await expect(page.getByTestId("billing-current-plan-card").getByText("ACTIVE")).toBeVisible();
  });

  test("Journey B — limit reached then upgrade path visible", async ({ page }) => {
    await page.goto("/dev/billing-preview?state=limit-reached");
    await expect(page.getByTestId("billing-limit-banner")).toBeVisible();
    await expect(page.getByRole("link", { name: "Compare plans" })).toBeVisible();

    await page.goto("/dev/billing-preview?state=upgrade");
    await expect(page.getByTestId("billing-upgrade-card")).toBeVisible();
    await expect(page.getByRole("button", { name: "Upgrade" }).first()).toBeVisible();
  });

  test("Journey C — payment failure and recovery UI", async ({ page }) => {
    await page.goto("/dev/billing-preview?state=payment-failed");
    await expect(page.getByText("Payment needs attention")).toBeVisible();
    await expect(page.getByRole("button", { name: "Update billing details" })).toBeVisible();

    await page.goto("/dev/billing-preview?state=current-plan");
    await expect(page.getByTestId("billing-current-plan-card")).toBeVisible();
    await expect(page.getByText("ACTIVE")).toBeVisible();
  });

  test("Journey D — cancellation at period end with resume", async ({ page }) => {
    await page.goto("/dev/billing-preview?state=cancelled");
    await expect(page.getByText(/scheduled to end/i)).toBeVisible();
    await expect(page.getByTestId("resume-subscription-button")).toBeVisible();
  });

  test("Journey E — billing API requires organisation context", async ({ request }) => {
    const response = await request.get("/api/billing/account", { maxRedirects: 0 });
    expect([302, 307, 400, 401, 403]).toContain(response.status());
  });

  test("capture required billing visual QA screenshots", async ({ page }) => {
    test.setTimeout(120_000);

    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/pricing");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "pricing-1440.png"), fullPage: true });

    const states = [
      ["current-plan", "billing-current-plan-1440.png"],
      ["usage", "billing-usage-1440.png"],
      ["upgrade", "billing-upgrade-1440.png"],
      ["limit-reached", "billing-limit-reached-1440.png"],
      ["payment-failed", "billing-payment-failed-1440.png"],
      ["cancelled", "billing-cancelled-period-end-1440.png"],
    ] as const;

    for (const [state, filename] of states) {
      await page.goto(`/dev/billing-preview?state=${state}`);
      await page.waitForSelector('[data-visual-preview="true"]');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: true });
    }
  });
});
