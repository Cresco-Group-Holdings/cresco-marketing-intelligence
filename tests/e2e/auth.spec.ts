import { test, expect } from "@playwright/test";

test.describe("authentication flows", () => {
  test("login page renders working form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeEnabled();
    await expect(page.getByLabel("Password")).toBeEnabled();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  });

  test("signup page renders working form", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByLabel("Work email")).toBeEnabled();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  });

  test("forgot password page renders working form", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeEnabled();
    await expect(page.getByRole("button", { name: "Send reset instructions" })).toBeVisible();
  });

  test("verify email page loads", async ({ page }) => {
    await page.goto("/verify-email");
    await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  });

  test("auth error page loads", async ({ page }) => {
    await page.goto("/auth/error?code=oauth_failed");
    await expect(page.getByRole("heading", { name: "Sign-in was cancelled or failed" })).toBeVisible();
  });

  test("unauthenticated user cannot access dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user cannot access account settings", async ({ page }) => {
    await page.goto("/settings/account");
    await expect(page).toHaveURL(/\/login/);
  });
});
