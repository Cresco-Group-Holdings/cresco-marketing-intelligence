import { describe, expect, it } from "vitest";
import {
  mapStripeStatusToSubscriptionStatus,
  normalizeSubscriptionAccess,
} from "@/lib/billing/subscription-state";

describe("subscription state normalization", () => {
  it("maps Stripe statuses to product subscription statuses", () => {
    expect(mapStripeStatusToSubscriptionStatus("active")).toBe("ACTIVE");
    expect(mapStripeStatusToSubscriptionStatus("past_due")).toBe("PAST_DUE");
    expect(mapStripeStatusToSubscriptionStatus("canceled")).toBe("CANCELLED");
  });

  it("allows access during past due grace period", () => {
    const recentPastDue = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const access = normalizeSubscriptionAccess({
      status: "PAST_DUE",
      pastDueSince: recentPastDue,
    });
    expect(access.productState).toBe("past_due_grace");
    expect(access.entitlementsActive).toBe(true);
    expect(access.inGracePeriod).toBe(true);
  });

  it("restricts access after grace period expires", () => {
    const oldPastDue = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const access = normalizeSubscriptionAccess({
      status: "PAST_DUE",
      pastDueSince: oldPastDue,
    });
    expect(access.productState).toBe("past_due_restricted");
    expect(access.entitlementsActive).toBe(false);
  });
});
