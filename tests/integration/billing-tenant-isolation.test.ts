import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";

import { AppError } from "@/lib/errors";

const subscriptionService = vi.hoisted(() => ({
  getSubscriptionSummary: vi.fn(),
  startCheckout: vi.fn(),
  openPortal: vi.fn(),
  cancelSubscription: vi.fn(),
  resumeSubscription: vi.fn(),
  reconcileWithStripe: vi.fn(),
  listInvoices: vi.fn(),
}));

const usageMeteringService = vi.hoisted(() => ({
  getUsageOverview: vi.fn(),
}));

const entitlementService = vi.hoisted(() => ({
  listEntitlements: vi.fn(),
  check: vi.fn(),
}));

const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/subscription-service", () => ({ subscriptionService }));
vi.mock("@/server/services/usage-metering-service", () => ({ usageMeteringService }));
vi.mock("@/server/services/entitlement-service", () => ({ entitlementService }));
vi.mock("@/lib/tenancy/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenancy/guards")>();
  return { ...actual, buildTenantContext };
});
vi.mock("@/lib/auth/provisioning", () => ({
  ensureUserProfile: vi.fn().mockResolvedValue({
    authUserId: "test-auth-user",
    userProfileId: "profile-tenant-a",
  }),
  extractProviderMetadata: vi.fn().mockReturnValue({}),
}));

import { GET as getBillingAccount } from "@/app/api/billing/account/route";
import { POST as postCheckout } from "@/app/api/billing/checkout/route";
import { POST as postPortal } from "@/app/api/billing/portal/route";
import { POST as postCancel } from "@/app/api/billing/subscription/cancel/route";
import { POST as postResume } from "@/app/api/billing/subscription/resume/route";
import { POST as postReconcile } from "@/app/api/billing/reconcile/route";
import { GET as getInvoices } from "@/app/api/billing/invoices/route";
import { POST as postEntitlementCheck } from "@/app/api/billing/entitlements/check/route";

const orgA = "org-tenant-a";
const orgB = "org-tenant-b";

const tenantA = {
  userId: "test-auth-user",
  userProfileId: "profile-tenant-a",
  organisationId: orgA,
  organisationRole: OrganisationRole.OWNER,
};

describe("billing cross-tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOW_TEST_AUTH = "true";
    process.env.TEST_AUTH_USER_ID = "test-auth-user";

    buildTenantContext.mockImplementation(async ({ organisationId }: { organisationId: string }) => {
      if (organisationId === orgA) return tenantA;
      throw new AppError(
        "ORGANISATION_MEMBERSHIP_REQUIRED",
        "You do not have access to this organisation.",
      );
    });

    subscriptionService.getSubscriptionSummary.mockResolvedValue({ plan: { key: "starter" } });
    subscriptionService.startCheckout.mockResolvedValue({ checkoutUrl: "https://checkout.test" });
    subscriptionService.openPortal.mockResolvedValue({ portalUrl: "https://portal.test" });
    subscriptionService.cancelSubscription.mockResolvedValue({ plan: { key: "starter" } });
    subscriptionService.resumeSubscription.mockResolvedValue({ plan: { key: "starter" } });
    subscriptionService.reconcileWithStripe.mockResolvedValue({ plan: { key: "starter" } });
    subscriptionService.listInvoices.mockResolvedValue([]);
    usageMeteringService.getUsageOverview.mockResolvedValue([]);
    entitlementService.listEntitlements.mockResolvedValue([]);
    entitlementService.check.mockResolvedValue({ allowed: true });
  });

  afterEach(() => {
    delete process.env.ALLOW_TEST_AUTH;
    delete process.env.TEST_AUTH_USER_ID;
  });

  const crossTenantCases: Array<{
    name: string;
    invoke: () => Promise<Response>;
    service: keyof typeof subscriptionService | "usage" | "entitlement";
    method: string;
  }> = [
    {
      name: "read billing account",
      invoke: () => getBillingAccount(new NextRequest(`https://app.test/api/billing/account?organisationId=${orgB}`)),
      service: "getSubscriptionSummary",
      method: "read BillingAccount",
    },
    {
      name: "read usage overview",
      invoke: () => getBillingAccount(new NextRequest(`https://app.test/api/billing/account?organisationId=${orgB}`)),
      service: "usage",
      method: "read usage",
    },
    {
      name: "create checkout",
      invoke: () =>
        postCheckout(
          new NextRequest(`https://app.test/api/billing/checkout?organisationId=${orgB}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              planKey: "starter",
              billingInterval: "MONTHLY",
              successUrl: "https://app.test/success",
              cancelUrl: "https://app.test/cancel",
            }),
          }),
        ),
      service: "startCheckout",
      method: "create checkout",
    },
    {
      name: "open billing portal",
      invoke: () =>
        postPortal(
          new NextRequest(`https://app.test/api/billing/portal?organisationId=${orgB}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ returnUrl: "https://app.test/settings/billing" }),
          }),
        ),
      service: "openPortal",
      method: "open portal",
    },
    {
      name: "cancel subscription",
      invoke: () =>
        postCancel(
          new NextRequest(`https://app.test/api/billing/subscription/cancel?organisationId=${orgB}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          }),
        ),
      service: "cancelSubscription",
      method: "cancel subscription",
    },
    {
      name: "resume subscription",
      invoke: () =>
        postResume(
          new NextRequest(`https://app.test/api/billing/subscription/resume?organisationId=${orgB}`, {
            method: "POST",
          }),
        ),
      service: "resumeSubscription",
      method: "resume subscription",
    },
    {
      name: "reconcile subscription",
      invoke: () =>
        postReconcile(
          new NextRequest(`https://app.test/api/billing/reconcile?organisationId=${orgB}`, {
            method: "POST",
          }),
        ),
      service: "reconcileWithStripe",
      method: "reconcile subscription",
    },
    {
      name: "list invoices",
      invoke: () => getInvoices(new NextRequest(`https://app.test/api/billing/invoices?organisationId=${orgB}`)),
      service: "listInvoices",
      method: "read invoices",
    },
    {
      name: "check entitlements",
      invoke: () =>
        postEntitlementCheck(
          new NextRequest(`https://app.test/api/billing/entitlements/check?organisationId=${orgB}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ entitlement: "brands.max", requestedAmount: 1 }),
          }),
        ),
      service: "entitlement",
      method: "check entitlements",
    },
  ];

  for (const testCase of crossTenantCases) {
    it(`denies Tenant A from attempting to ${testCase.name} for Tenant B`, async () => {
      const response = await testCase.invoke();
      expect(response.status).toBeGreaterThanOrEqual(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error?.code).toMatch(/ORGANISATION_MEMBERSHIP_REQUIRED|FORBIDDEN|UNAUTHORIZED/);

      if (testCase.service === "usage") {
        expect(usageMeteringService.getUsageOverview).not.toHaveBeenCalled();
      } else if (testCase.service === "entitlement") {
        expect(entitlementService.check).not.toHaveBeenCalled();
      } else {
        expect(subscriptionService[testCase.service as keyof typeof subscriptionService]).not.toHaveBeenCalled();
      }
    });
  }

  it("scopes checkout to the authenticated tenant organisation", async () => {
    const response = await postCheckout(
      new NextRequest(`https://app.test/api/billing/checkout?organisationId=${orgA}`, {
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
    expect(response.status).toBe(200);
    expect(subscriptionService.startCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ organisationId: orgA }),
      expect.any(Object),
    );
  });
});
