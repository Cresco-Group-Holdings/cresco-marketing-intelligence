import { describe, expect, it } from "vitest";
import { mapEntitlementResultToUserMessage } from "@/lib/billing/user-facing-errors";

describe("billing user-facing errors", () => {
  it("maps plan limit exceeded to upgrade CTA", () => {
    const message = mapEntitlementResultToUserMessage(
      {
        allowed: false,
        code: "PLAN_LIMIT_EXCEEDED",
        entitlement: "brands.max",
        currentUsage: 2,
        allowance: 2,
        upgradePlanKey: "professional",
      },
      "starter",
    );
    expect(message.title).toBe("Plan limit reached");
    expect(message.ctaHref).toBe("/pricing");
    expect(message.message).toContain("Starter");
    expect(message.message).not.toContain("403");
  });

  it("maps payment action required to billing CTA", () => {
    const message = mapEntitlementResultToUserMessage({
      allowed: false,
      code: "PAYMENT_ACTION_REQUIRED",
      entitlement: "ai.tokens_monthly",
    });
    expect(message.ctaHref).toBe("/settings/billing");
    expect(message.message).toContain("payment");
  });
});
