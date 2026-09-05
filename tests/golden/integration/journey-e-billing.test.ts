/**
 * Journey E — Billing & Entitlements
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";
import { DEFAULT_PLAN_CATALOG } from "@/lib/billing/plan-catalog";
import { finishJourneyMonitor, resetJourneyMonitor } from "../harness/journey-monitor";
import { AppError } from "@/lib/errors";

const subscriptionService = vi.hoisted(() => ({
  getSubscriptionSummary: vi.fn(),
  startCheckout: vi.fn(),
  openPortal: vi.fn(),
  cancelSubscription: vi.fn(),
  resumeSubscription: vi.fn(),
  reconcileWithStripe: vi.fn(),
}));

const entitlementService = vi.hoisted(() => ({
  listEntitlements: vi.fn(),
  check: vi.fn(),
}));

const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/subscription-service", () => ({ subscriptionService }));
vi.mock("@/server/services/usage-metering-service", () => ({
  usageMeteringService: { getUsageOverview: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/server/services/entitlement-service", () => ({ entitlementService }));
vi.mock("@/lib/tenancy/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenancy/guards")>();
  return { ...actual, buildTenantContext };
});
vi.mock("@/lib/auth/provisioning", () => ({
  ensureUserProfile: vi.fn().mockResolvedValue({ authUserId: "auth-golden-e", userProfileId: "profile-golden-e" }),
  extractProviderMetadata: vi.fn().mockReturnValue({}),
}));

import { POST as postCheckout } from "@/app/api/billing/checkout/route";
import { POST as postEntitlementCheck } from "@/app/api/billing/entitlements/check/route";

const orgId = "org-golden-e";

describe("Golden Journey E — Billing & Entitlements", () => {
  beforeEach(() => {
    resetJourneyMonitor();
    vi.clearAllMocks();
    process.env.ALLOW_TEST_AUTH = "true";
    process.env.TEST_AUTH_USER_ID = "auth-golden-e";
    buildTenantContext.mockResolvedValue({
      userId: "auth-golden-e",
      userProfileId: "profile-golden-e",
      organisationId: orgId,
      organisationRole: OrganisationRole.OWNER,
    });
    subscriptionService.startCheckout.mockResolvedValue({ checkoutUrl: "https://checkout.stripe.test/session" });
    entitlementService.check.mockResolvedValue({ allowed: true, remaining: 5 });
  });

  afterEach(() => {
    delete process.env.ALLOW_TEST_AUTH;
    delete process.env.TEST_AUTH_USER_ID;
  });

  it("uses canonical plan catalogue and rejects price tampering", async () => {
    const starter = DEFAULT_PLAN_CATALOG.find((p) => p.key === "starter");
    expect(starter).toBeDefined();
    expect(starter?.monthlyPriceCents).toBeGreaterThan(0);

    const valid = await postCheckout(
      new NextRequest(`https://app.test/api/billing/checkout?organisationId=${orgId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planKey: "starter",
          billingInterval: "MONTHLY",
          successUrl: "https://app.test/success",
          cancelUrl: "https://app.test/cancel",
        }),
      }),
    );
    expect(valid.status).toBe(200);
    expect(subscriptionService.startCheckout).toHaveBeenCalled();

    subscriptionService.startCheckout.mockRejectedValueOnce(
      new AppError("VALIDATION_ERROR", "Plan price mismatch."),
    );
    const tampered = await postCheckout(
      new NextRequest(`https://app.test/api/billing/checkout?organisationId=${orgId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planKey: "starter",
          billingInterval: "MONTHLY",
          successUrl: "https://app.test/success",
          cancelUrl: "https://app.test/cancel",
          priceId: "price_evil",
        }),
      }),
    );
    expect(tampered.status).toBeGreaterThanOrEqual(400);

    const metrics = finishJourneyMonitor();
    expect(metrics.unexpected5xx).toBe(0);
  });

  it("enforces entitlement limits with structured denial", async () => {
    entitlementService.check.mockResolvedValueOnce({
      allowed: false,
      reason: "LIMIT_REACHED",
      message: "Publication limit reached for this billing period.",
    });

    const response = await postEntitlementCheck(
      new NextRequest(`https://app.test/api/billing/entitlements/check?organisationId=${orgId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entitlement: "publications.monthly", requestedAmount: 1 }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.result.allowed).toBe(false);
  });
});
