import { test, expect } from "@playwright/test";
import path from "node:path";

const OUTPUT = "/opt/cursor/artifacts/screenshots";

const PRODUCT_SHOTS = [
  { file: "launch-command-centre-1440.png", url: "/dev/command-centre-preview" },
  { file: "launch-organic-social-1440.png", url: "/dev/organic-growth-preview/overview" },
  { file: "launch-content-studio-1440.png", url: "/dev/content-intelligence-preview/overview" },
  { file: "launch-analytics-1440.png", url: "/dev/analytics-preview/overview" },
  { file: "launch-attribution-1440.png", url: "/dev/analytics-preview/attribution" },
  { file: "launch-automations-1440.png", url: "/automations" },
  { file: "launch-integrations-1440.png", url: "/integrations" },
  { file: "launch-billing-1440.png", url: "/dev/billing-preview?state=current-plan" },
  { file: "launch-onboarding-1440.png", url: "/onboarding" },
] as const;

test.describe("@launch-critical product screenshots", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(() => {
    test.skip(process.env.NODE_ENV === "production", "Dev preview routes unavailable in production");
  });

  for (const shot of PRODUCT_SHOTS) {
    test(`capture ${shot.file}`, async ({ page }) => {
      const needsAuth = shot.url === "/automations" || shot.url === "/integrations" || shot.url === "/onboarding";
      test.skip(needsAuth && process.env.ALLOW_TEST_AUTH !== "true", "Requires ALLOW_TEST_AUTH");

      await page.goto(shot.url, { waitUntil: "domcontentloaded" });
      if (shot.url.startsWith("/dev/")) {
        await page.waitForSelector('[data-visual-preview="true"]', { timeout: 60_000 });
      }
      await page.screenshot({ path: path.join(OUTPUT, shot.file), fullPage: true });
    });
  }
});

test.describe("@launch-critical launch journeys", () => {
  test("Journey 1 — Intelligence surfaces recommendation evidence", async ({ page }) => {
    test.skip(process.env.NODE_ENV === "production", "Uses dev preview fixtures");
    await page.goto("/dev/command-centre-preview");
    await page.waitForSelector('[data-visual-preview="true"]');
    await expect(page.getByText(/Marketing Health|Today's Priorities|recommendation/i).first()).toBeVisible();
  });

  test("Journey 3 — Weekly operating loop visible in Command Centre", async ({ page }) => {
    test.skip(process.env.NODE_ENV === "production", "Uses dev preview fixtures");
    await page.goto("/dev/command-centre-preview");
    await page.waitForSelector('[data-visual-preview="true"]');
    await expect(page.getByText(/priority|attention|recommend/i).first()).toBeVisible();
  });

  test("Journey 4 — Billing plan and upgrade surfaces", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: "Pricing" })).toBeVisible();
    await page.goto("/dev/billing-preview?state=upgrade");
    await page.waitForSelector('[data-visual-preview="true"]');
    await expect(page.getByTestId("billing-upgrade-card")).toBeVisible();
  });

  test("Journey 5 — Provider degradation priority in preview fixture", async ({ page }) => {
    test.skip(process.env.NODE_ENV === "production", "Uses dev preview fixtures");
    await page.goto("/dev/organic-growth-preview/overview");
    await page.waitForSelector('[data-visual-preview="true"]');
    await expect(page.getByText(/reconnect|connection|account/i).first()).toBeVisible();
  });
});
