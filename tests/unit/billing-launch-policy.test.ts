import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertBillingSelfServiceAvailable,
  isBillingSelfServiceAvailable,
} from "@/lib/billing/launch-policy";

describe("billing launch policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.BILLING_SELF_SERVICE_LAUNCH_ENABLED;
    delete process.env.STRIPE_BILLING_SECRET_KEY;
    delete process.env.STRIPE_BILLING_WEBHOOK_SECRET;
    delete process.env.ALLOW_BILLING_MOCK;
  });

  it("defaults to billing disabled for launch", () => {
    expect(isBillingSelfServiceAvailable()).toBe(false);
    expect(() => assertBillingSelfServiceAvailable()).toThrow(/not available/i);
  });

  it("requires stripe configuration when launch flag is enabled in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BILLING_SELF_SERVICE_LAUNCH_ENABLED", "true");
    expect(isBillingSelfServiceAvailable()).toBe(false);
  });

  it("allows mock billing in development when launch flag is enabled", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BILLING_SELF_SERVICE_LAUNCH_ENABLED", "true");
    vi.stubEnv("ALLOW_BILLING_MOCK", "true");
    expect(isBillingSelfServiceAvailable()).toBe(true);
  });
});
