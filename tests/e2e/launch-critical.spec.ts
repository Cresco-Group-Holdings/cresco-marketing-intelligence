import { test, expect } from "@playwright/test";

test.describe("@launch-critical public website", () => {
  test("home page communicates product value", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: /Connect your marketing stack/i,
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Start using Cresco" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "View product" })).toBeVisible();
  });

  test("product page loads", async ({ page }) => {
    await page.goto("/product");
    await expect(
      page.getByRole("heading", { name: /One product for the full marketing loop/i }),
    ).toBeVisible();
  });

  test("pricing page loads from plan catalogue", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: "Pricing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Starter" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pro" })).toBeVisible();
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("unauthenticated user cannot access dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("@launch-critical legacy redirects", () => {
  test("legacy content route redirects to Content Studio", async ({ page }) => {
    await page.goto("/content");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcontent%2Fstudio|\/content\/studio/);
  });

  test("legacy connectors route redirects to Integrations", async ({ page }) => {
    await page.goto("/connectors");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fintegrations|\/integrations/);
  });

  test("legacy social connections redirect to organic accounts", async ({ page }) => {
    await page.goto("/social/connections");
    await expect(page).toHaveURL(
      /\/login\?redirect=%2Forganic-social%2Faccounts|\/organic-social\/accounts/,
    );
  });

  test("legacy analyst route redirects to Ask Cresco", async ({ page }) => {
    await page.goto("/analyst");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcopilot|\/copilot/);
  });
});

test.describe("@launch-critical dev route gating", () => {
  test("dev preview routes are accessible in development for local QA", async ({ page }) => {
    await page.goto("/dev/command-centre-preview");
    await expect(page).toHaveURL(/\/dev\/command-centre-preview/);
  });
});

test.describe("@launch-critical authenticated navigation", () => {
  test.beforeEach(() => {
    test.skip(process.env.ALLOW_TEST_AUTH !== "true", "Requires ALLOW_TEST_AUTH for authenticated flows");
  });

  test("integrations page is canonical for provider connections", async ({ page }) => {
    await page.goto("/integrations");
    await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
  });

  test("content studio route is reachable", async ({ page }) => {
    await page.goto("/content/studio");
    await expect(page).toHaveURL(/\/content\/studio/);
  });
});
