import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertTestAuthNotEnabledInProduction,
  isProductionEnvironment,
  isTestAuthBypassEnabled,
} from "@/lib/security/production-guards";
import {
  isPublicApiRoute,
  isProtectedRoute,
  isDevPreviewRoute,
} from "@/lib/auth/routes";

describe("production guards", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("detects production environment", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isProductionEnvironment()).toBe(true);
  });

  it("throws when test auth is enabled in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_TEST_AUTH", "true");
    expect(() => assertTestAuthNotEnabledInProduction()).toThrow(/ALLOW_TEST_AUTH/);
  });

  it("disables test auth bypass in production even if env is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_TEST_AUTH", "true");
    vi.stubEnv("TEST_AUTH_USER_ID", "user-1");
    expect(isTestAuthBypassEnabled()).toBe(false);
  });

  it("enables test auth bypass only with explicit harness flag in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_TEST_AUTH", "true");
    vi.stubEnv("TEST_AUTH_USER_ID", "user-1");
    expect(isTestAuthBypassEnabled()).toBe(false);
    vi.stubEnv("CRESCO_E2E_HARNESS", "true");
    expect(isTestAuthBypassEnabled()).toBe(true);
  });
});

describe("public API route exclusions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows Stripe and billing webhooks without session", () => {
    expect(isProtectedRoute("/api/webhooks/stripe")).toBe(false);
    expect(isProtectedRoute("/api/webhooks/billing/stripe")).toBe(false);
    expect(isPublicApiRoute("/api/webhooks/stripe")).toBe(true);
  });

  it("allows public form submissions without session", () => {
    expect(isProtectedRoute("/api/forms/v1/form-abc/submit")).toBe(false);
    expect(isPublicApiRoute("/api/forms/v1/form-abc/submit")).toBe(true);
  });

  it("allows server-side tracking without session", () => {
    expect(isProtectedRoute("/api/tracking/v1/server-events")).toBe(false);
    expect(isProtectedRoute("/api/tracking/v1/events")).toBe(false);
  });

  it("allows OAuth callbacks without session", () => {
    expect(isProtectedRoute("/api/integrations/oauth/meta/callback")).toBe(false);
    expect(isProtectedRoute("/api/social/oauth/callback")).toBe(false);
    expect(isProtectedRoute("/api/connectors/oauth/callback")).toBe(false);
  });

  it("still protects authenticated API routes", () => {
    expect(isProtectedRoute("/api/brands/brand-1/profile")).toBe(true);
    expect(isProtectedRoute("/api/analytics/workspace")).toBe(true);
    expect(isProtectedRoute("/api/billing/checkout")).toBe(true);
  });

  it("allows worker and cron routes without session", () => {
    expect(isProtectedRoute("/api/workers/process")).toBe(false);
    expect(isProtectedRoute("/api/cron/daily-dispatch")).toBe(false);
    expect(isProtectedRoute("/api/publishing-scheduler/process-due")).toBe(false);
  });

  it("exposes dev security preview only in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isDevPreviewRoute("/dev/security-preview/overview")).toBe(true);
    expect(isProtectedRoute("/dev/security-preview/overview")).toBe(false);
    vi.stubEnv("NODE_ENV", "production");
    expect(isDevPreviewRoute("/dev/security-preview/overview")).toBe(false);
    expect(isProtectedRoute("/dev/security-preview/overview")).toBe(true);
  });

  it("blocks billing and onboarding previews in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isDevPreviewRoute("/dev/billing-preview")).toBe(false);
    expect(isDevPreviewRoute("/dev/onboarding-preview/welcome")).toBe(false);
    expect(isProtectedRoute("/dev/billing-preview")).toBe(true);
    expect(isProtectedRoute("/dev/onboarding-preview/welcome")).toBe(true);
  });
});
