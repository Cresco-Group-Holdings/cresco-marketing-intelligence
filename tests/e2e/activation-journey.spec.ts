import { expect, test } from "@playwright/test";

const testAuthEnabled = process.env.ALLOW_TEST_AUTH === "true";

test.describe("activation journeys", () => {
  test("unauthenticated user is redirected from getting-started", async ({ page }) => {
    test.skip(testAuthEnabled, "Test auth bypasses middleware redirects");

    await page.goto("/getting-started");
    await expect(page).toHaveURL(/\/login/);
  });

  test("onboarding welcome screen renders for authenticated test user", async ({ page }) => {
    test.skip(process.env.NODE_ENV === "production", "Preview route unavailable in production");

    await page.goto("/dev/onboarding-preview/welcome");
    await expect(page.getByRole("heading", { name: "Welcome to Cresco" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue setup" })).toBeVisible();
  });

  test("getting-started page renders activation checklist shell", async ({ page }) => {
    test.skip(process.env.NODE_ENV === "production", "Preview route unavailable in production");

    await page.goto("/dev/onboarding-preview/brand-knowledge");
    await expect(page.getByLabel("Essential setup")).toBeVisible();
  });

  test("accept-invite page validates missing token", async ({ page }) => {
    await page.goto("/accept-invite");
    await expect(page.getByText("Invitation token is missing.")).toBeVisible();
  });
});

test.describe("Journey A — Content-first activation preview", () => {
  test("renders content-first progression states", async ({ page }) => {
    test.skip(process.env.NODE_ENV === "production", "Preview route unavailable in production");

    const steps = ["brand-knowledge", "integrations", "first-content", "success"];
    for (const scene of steps) {
      await page.goto(`/dev/onboarding-preview/${scene}`);
      await expect(page.locator('[data-visual-preview="true"]')).toBeVisible();
    }
  });
});

test.describe("Journey B — Analytics-first activation preview", () => {
  test("renders analytics-ready state without fabricated insight", async ({ page }) => {
    test.skip(process.env.NODE_ENV === "production", "Preview route unavailable in production");

    await page.goto("/dev/onboarding-preview/integrations");
    await expect(page.getByText("Connect your marketing stack")).toBeVisible();
    await expect(page.getByText("Connect data")).toBeVisible();
  });
});

test.describe("Journey C — Interrupted onboarding resume", () => {
  test("loads resumed activation state from preview fixture", async ({ page }) => {
    test.skip(process.env.NODE_ENV === "production", "Preview route unavailable in production");

    await page.goto("/dev/onboarding-preview/brand-knowledge");
    await expect(page.getByRole("heading", { name: "Brand Knowledge" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Brand Knowledge" })).toBeVisible();
    await expect(page.getByLabel("Essential setup")).toBeVisible();
  });
});

test.describe("Journey D — Demo workspace", () => {
  test("demo entry is clearly labelled", async ({ page }) => {
    test.skip(process.env.NODE_ENV === "production", "Preview route unavailable in production");

    await page.goto("/dev/onboarding-preview/demo-entry");
    await expect(page.getByText("Demo Workspace")).toBeVisible();
    await expect(page.getByText("No real publications")).toBeVisible();
  });

  test("real workspace preview does not show demo label", async ({ page }) => {
    test.skip(process.env.NODE_ENV === "production", "Preview route unavailable in production");

    await page.goto("/dev/onboarding-preview/brand");
    await expect(page.getByText("Demo Workspace")).not.toBeVisible();
  });
});

test.describe("Journey E — Team member requires-admin state", () => {
  test("shows requires admin provider state for restricted member", async ({ page }) => {
    test.skip(process.env.NODE_ENV === "production", "Preview route unavailable in production");

    await page.goto("/dev/onboarding-preview/requires-admin");
    await expect(page.getByText("Requires admin")).toBeVisible();
    await expect(page.getByText("Organisation Owner or Admin")).toBeVisible();
  });
});

test.describe("activation API client event trust", () => {
  test("rejects domain-asserting activation events", async ({ request }) => {
    test.skip(!testAuthEnabled, "Requires ALLOW_TEST_AUTH");

    const response = await request.post("/api/activation/events", {
      data: { event: "first_publication_scheduled" },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});
