import { describe, expect, it } from "vitest";
import {
  BILLING_CURRENCY,
  formatPlanPrice,
  LAUNCH_ANALYTICS_HISTORY_GATING_ENABLED,
  LAUNCH_ATTRIBUTION_MODEL_GATING_ENABLED,
  LAUNCH_PLAN_KEYS,
  resolvePlanKeyFromStripePriceId,
  suggestUpgradePlanKey,
  TRIAL_ENABLED_AT_LAUNCH,
} from "@/lib/billing/commercial-config";

describe("commercial config", () => {
  it("defines launch plan keys", () => {
    expect(LAUNCH_PLAN_KEYS.STARTER).toBe("starter");
    expect(LAUNCH_PLAN_KEYS.PRO).toBe("professional");
    expect(LAUNCH_PLAN_KEYS.ORGANISATION).toBe("business");
  });

  it("suggests the next plan in upgrade order", () => {
    expect(suggestUpgradePlanKey("free")).toBe("starter");
    expect(suggestUpgradePlanKey("starter")).toBe("professional");
    expect(suggestUpgradePlanKey("professional")).toBe("business");
  });

  it("formats GBP prices", () => {
    expect(formatPlanPrice(4900, BILLING_CURRENCY)).toBe("£49");
    expect(formatPlanPrice(0, BILLING_CURRENCY)).toBe("Free");
  });

  it("documents trial policy for launch", () => {
    expect(TRIAL_ENABLED_AT_LAUNCH).toBe(false);
  });

  it("resolves plan key from configured Stripe price IDs", () => {
    process.env.STRIPE_PRICE_STARTER_MONTHLY = "price_starter_m";
    expect(resolvePlanKeyFromStripePriceId("price_starter_m")).toBe("starter");
    delete process.env.STRIPE_PRICE_STARTER_MONTHLY;
  });

  it("documents analytics and attribution gating as post-launch", () => {
    expect(LAUNCH_ANALYTICS_HISTORY_GATING_ENABLED).toBe(false);
    expect(LAUNCH_ATTRIBUTION_MODEL_GATING_ENABLED).toBe(false);
  });
});
