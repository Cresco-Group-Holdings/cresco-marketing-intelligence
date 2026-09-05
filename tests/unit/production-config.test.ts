import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertTestAuthNotEnabledInProduction,
  isE2EHarnessEnabled,
  isTestAuthBypassEnabled,
} from "@/lib/security/production-guards";
import {
  formatProductionConfigReport,
  runProductionConfigValidation,
  validateApplicationUrls,
  validateForbiddenProductionFlags,
  validateStripeConfiguration,
  validateWorkerAndCronSecrets,
} from "@/lib/security/production-config";

const BASE_ENV = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user:pass@db.example.supabase.co:6543/postgres?pgbouncer=true",
  DIRECT_URL: "postgresql://user:pass@db.example.supabase.co:5432/postgres",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-with-sufficient-length",
  APP_URL: "https://app.example.com",
  ENCRYPTION_KEY: "a".repeat(32),
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-with-sufficient-length",
};

function withEnv(overrides: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("production config validation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    for (const key of Object.keys(BASE_ENV)) {
      delete process.env[key];
    }
    delete process.env.WORKER_TOKEN;
    delete process.env.PUBLISHING_WORKER_TOKEN;
    delete process.env.CRON_SECRET;
    delete process.env.STRIPE_BILLING_SECRET_KEY;
    delete process.env.STRIPE_BILLING_WEBHOOK_SECRET;
    delete process.env.STRIPE_BILLING_PUBLISHABLE_KEY;
    delete process.env.ALLOW_TEST_AUTH;
    delete process.env.CRESCO_E2E_HARNESS;
    delete process.env.BILLING_SELF_SERVICE_LAUNCH_ENABLED;
    delete process.env.VERCEL_ENV;
  });

  it("fails when test auth is enabled in production", () => {
    withEnv({ NODE_ENV: "production", ALLOW_TEST_AUTH: "true" });
    const checks = validateForbiddenProductionFlags();
    expect(checks.some((check) => check.id === "forbidden-flag-ALLOW_TEST_AUTH" && !check.pass)).toBe(
      true,
    );
    expect(() => assertTestAuthNotEnabledInProduction()).toThrow(/ALLOW_TEST_AUTH/);
  });

  it("fails when E2E harness is enabled in production", () => {
    withEnv({ NODE_ENV: "production", CRESCO_E2E_HARNESS: "true" });
    expect(() => assertTestAuthNotEnabledInProduction()).toThrow(/CRESCO_E2E_HARNESS/);
    expect(isE2EHarnessEnabled()).toBe(false);
  });

  it("disables test auth bypass in production even if env is set", () => {
    withEnv({
      NODE_ENV: "production",
      ALLOW_TEST_AUTH: "true",
      TEST_AUTH_USER_ID: "user-1",
    });
    expect(isTestAuthBypassEnabled()).toBe(false);
  });

  it("requires worker and cron secrets in production mode", () => {
    withEnv({ VERCEL_ENV: "production", NODE_ENV: "production" });
    const checks = validateWorkerAndCronSecrets();
    expect(checks.find((check) => check.id === "worker-token-present")?.pass).toBe(false);
    expect(checks.find((check) => check.id === "cron-secret-present")?.pass).toBe(false);
  });

  it("passes worker and cron secrets when configured", () => {
    withEnv({
      VERCEL_ENV: "production",
      NODE_ENV: "production",
      WORKER_TOKEN: "worker-secret-token",
      CRON_SECRET: "cron-secret-token",
    });
    const checks = validateWorkerAndCronSecrets();
    expect(checks.find((check) => check.id === "worker-token-present")?.pass).toBe(true);
    expect(checks.find((check) => check.id === "cron-secret-present")?.pass).toBe(true);
  });

  it("rejects localhost APP_URL in production", () => {
    withEnv({ VERCEL_ENV: "production", NODE_ENV: "production", APP_URL: "http://localhost:3000" });
    const checks = validateApplicationUrls();
    expect(checks.find((check) => check.id === "app-url-not-localhost")?.pass).toBe(false);
  });

  it("detects Stripe key mode mismatch", () => {
    withEnv({
      STRIPE_BILLING_SECRET_KEY: "sk_live_example",
      STRIPE_BILLING_WEBHOOK_SECRET: "whsec_example",
      STRIPE_BILLING_PUBLISHABLE_KEY: "pk_test_example",
      STRIPE_PRICE_STARTER_MONTHLY: "price_starter_m",
      STRIPE_PRICE_STARTER_ANNUAL: "price_starter_a",
      STRIPE_PRICE_PRO_MONTHLY: "price_pro_m",
      STRIPE_PRICE_PRO_ANNUAL: "price_pro_a",
      STRIPE_PRICE_ORGANISATION_MONTHLY: "price_org_m",
      STRIPE_PRICE_ORGANISATION_ANNUAL: "price_org_a",
    });
    const checks = validateStripeConfiguration();
    expect(checks.find((check) => check.id === "stripe-key-mode-pairing")?.pass).toBe(false);
  });

  it("requires Stripe live mode in production when billing launch is enabled", () => {
    withEnv({
      VERCEL_ENV: "production",
      NODE_ENV: "production",
      BILLING_SELF_SERVICE_LAUNCH_ENABLED: "true",
      STRIPE_BILLING_SECRET_KEY: "sk_test_example",
      STRIPE_BILLING_WEBHOOK_SECRET: "whsec_example",
      STRIPE_BILLING_PUBLISHABLE_KEY: "pk_test_example",
      STRIPE_PRICE_STARTER_MONTHLY: "price_starter_m",
      STRIPE_PRICE_STARTER_ANNUAL: "price_starter_a",
      STRIPE_PRICE_PRO_MONTHLY: "price_pro_m",
      STRIPE_PRICE_PRO_ANNUAL: "price_pro_a",
      STRIPE_PRICE_ORGANISATION_MONTHLY: "price_org_m",
      STRIPE_PRICE_ORGANISATION_ANNUAL: "price_org_a",
    });
    const checks = validateStripeConfiguration();
    expect(checks.find((check) => check.id === "stripe-production-live-mode")?.pass).toBe(false);
  });

  it("does not require Stripe when billing is not launch-enabled", () => {
    withEnv({ VERCEL_ENV: "production", NODE_ENV: "production" });
    const checks = validateStripeConfiguration();
    expect(checks.find((check) => check.id === "stripe-billing-launch-policy")?.message).toContain(
      "NOT LAUNCH-ENABLED",
    );
    expect(checks.find((check) => check.id === "stripe-production-live-mode")).toBeUndefined();
  });

  it("allows disabled providers without blocking validation", () => {
    withEnv({});
    const report = runProductionConfigValidation();
    expect(report.checks.some((check) => check.id === "disabled-providers-non-blocking")).toBe(true);
    expect(formatProductionConfigReport(report)).toContain("Overall:");
  });
});
