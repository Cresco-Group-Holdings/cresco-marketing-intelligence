import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";
import { createHmac } from "node:crypto";
import { AppError } from "@/lib/errors";
import {
  COMMERCIAL_EXEMPT_ORGANISATION_IDS,
  isCommercialUsageExempt,
} from "@/lib/billing/commercial-exempt";
import {
  STRIPE_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
  verifyStripeWebhookSignature,
} from "@/lib/revenue/stripe-webhook";
import { isClientDomainAssertingEvent } from "@/lib/activation/truth";
import {
  isDevPreviewRoute,
  isProtectedRoute,
  isPublicApiRoute,
  isWorkerApiRoute,
} from "@/lib/auth/routes";
import {
  assertTestAuthNotEnabledInProduction,
  isTestAuthBypassEnabled,
} from "@/lib/security/production-guards";
import { isAuthorisedCronRequest, isAuthorisedWorkerRequest } from "@/lib/api/worker-auth";

const subscriptionService = vi.hoisted(() => ({
  getSubscriptionSummary: vi.fn(),
  startCheckout: vi.fn(),
  openPortal: vi.fn(),
  cancelSubscription: vi.fn(),
  resumeSubscription: vi.fn(),
  reconcileWithStripe: vi.fn(),
  listInvoices: vi.fn(),
}));

const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/subscription-service", () => ({ subscriptionService }));
vi.mock("@/server/services/usage-metering-service", () => ({
  usageMeteringService: { getUsageOverview: vi.fn() },
}));
vi.mock("@/server/services/entitlement-service", () => ({
  entitlementService: { listEntitlements: vi.fn(), check: vi.fn() },
}));
vi.mock("@/lib/tenancy/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenancy/guards")>();
  return { ...actual, buildTenantContext };
});
vi.mock("@/lib/auth/provisioning", () => ({
  ensureUserProfile: vi.fn().mockResolvedValue({
    authUserId: "test-auth-user",
    userProfileId: "profile-a",
  }),
  extractProviderMetadata: vi.fn().mockReturnValue({}),
}));

describe("Task 9.1 integrated security regression", () => {
  describe("billing — webhook and commercial boundaries", () => {
    it("enforces 300-second Stripe webhook timestamp tolerance", () => {
      expect(STRIPE_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS).toBe(300);
    });

    it("rejects stale Stripe signatures", () => {
      const secret = "whsec_test";
      const payload = JSON.stringify({ id: "evt_stale" });
      const stale = Math.floor((Date.now() - 301_000) / 1000);
      const sig = createHmac("sha256", secret).update(`${stale}.${payload}`).digest("hex");
      const header = `t=${stale},v1=${sig}`;

      expect(
        verifyStripeWebhookSignature(payload, header, {
          secretKey: "sk_test",
          webhookSecret: secret,
          apiVersion: "2024-06-20",
        }).valid,
      ).toBe(false);
    });

    it("does not exempt production organisations by slug-like names", () => {
      expect(isCommercialUsageExempt("cldemoorg123456789")).toBe(false);
      expect(isCommercialUsageExempt("org-production-real")).toBe(false);
    });

    it("only exempts trusted server-owned preview organisation IDs", () => {
      for (const id of COMMERCIAL_EXEMPT_ORGANISATION_IDS) {
        expect(isCommercialUsageExempt(id)).toBe(true);
      }
      expect(COMMERCIAL_EXEMPT_ORGANISATION_IDS.size).toBe(3);
    });
  });

  describe("demo/commercial exemptions — spoof resistance", () => {
    it("rejects user-supplied demo org names that are not server fixture IDs", () => {
      const spoofAttempts = ["demo-org-slug", "org-demo-user", "my-org-preview", "demo-org-tenant-a"];
      for (const id of spoofAttempts) {
        expect(isCommercialUsageExempt(id)).toBe(false);
      }
    });
  });

  describe("workers / scheduler — fail closed", () => {
    afterEach(() => {
      delete process.env.WORKER_TOKEN;
      delete process.env.CRON_SECRET;
    });

    it("rejects unauthenticated worker invocations", () => {
      process.env.WORKER_TOKEN = "worker-secret";
      const request = new NextRequest("http://localhost/api/workers/process", { method: "POST" });
      expect(isAuthorisedWorkerRequest(request)).toBe(false);
    });

    it("rejects worker routes when token unset", () => {
      const request = new NextRequest("http://localhost/api/workers/process", {
        method: "POST",
        headers: { authorization: "Bearer anything" },
      });
      expect(isAuthorisedWorkerRequest(request)).toBe(false);
    });

    it("rejects cron dispatch without CRON_SECRET", () => {
      const request = new NextRequest("http://localhost/api/cron/daily-dispatch", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret" },
      });
      expect(isAuthorisedCronRequest(request)).toBe(false);
    });

    it("lists worker API prefixes as non-session routes but auth-gated in handlers", () => {
      expect(isWorkerApiRoute("/api/workers/process")).toBe(true);
      expect(isWorkerApiRoute("/api/publishing-scheduler/process-due")).toBe(true);
      expect(isPublicApiRoute("/api/workers/process")).toBe(true);
      expect(isProtectedRoute("/api/billing/checkout")).toBe(true);
    });
  });

  describe("activation — client event trust", () => {
    it("classifies publication scheduling as domain-asserting", () => {
      expect(isClientDomainAssertingEvent("first_publication_scheduled")).toBe(true);
      expect(isClientDomainAssertingEvent("first_analytics_view")).toBe(false);
    });
  });

  describe("test-auth — production impossibility", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("throws on production startup when ALLOW_TEST_AUTH is set", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ALLOW_TEST_AUTH", "true");
      expect(() => assertTestAuthNotEnabledInProduction()).toThrow(/ALLOW_TEST_AUTH/);
    });

    it("disables bypass in production even if env vars are present", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ALLOW_TEST_AUTH", "true");
      vi.stubEnv("TEST_AUTH_USER_ID", "spoof-user");
      expect(isTestAuthBypassEnabled()).toBe(false);
    });
  });

  describe("production dev routes", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    const previewRoutes = [
      "/dev/security-preview/overview",
      "/dev/billing-preview",
      "/dev/onboarding-preview/welcome",
      "/dev/command-centre-preview",
    ];

    it("blocks all dev preview routes in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      for (const route of previewRoutes) {
        expect(isDevPreviewRoute(route)).toBe(false);
        expect(isProtectedRoute(route)).toBe(true);
      }
    });

    it("allows dev preview routes only in development", () => {
      vi.stubEnv("NODE_ENV", "development");
      for (const route of previewRoutes) {
        expect(isDevPreviewRoute(route)).toBe(true);
        expect(isProtectedRoute(route)).toBe(false);
      }
    });
  });

  describe("OAuth/public API boundaries", () => {
    it("exposes only intended unauthenticated API surfaces", () => {
      expect(isPublicApiRoute("/api/webhooks/stripe")).toBe(true);
      expect(isPublicApiRoute("/api/forms/v1/form-1/submit")).toBe(true);
      expect(isPublicApiRoute("/api/integrations/oauth/meta/callback")).toBe(true);
      expect(isPublicApiRoute("/api/billing/checkout")).toBe(false);
      expect(isPublicApiRoute("/api/activation")).toBe(false);
    });
  });
});

describe("Task 9.1 billing route authorization", () => {
  const orgA = "org-a";
  const orgB = "org-b";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOW_TEST_AUTH = "true";
    process.env.TEST_AUTH_USER_ID = "test-auth-user";

    buildTenantContext.mockImplementation(async ({ organisationId }: { organisationId: string }) => {
      if (organisationId === orgA) {
        return {
          userId: "test-auth-user",
          userProfileId: "profile-a",
          organisationId: orgA,
          organisationRole: OrganisationRole.OWNER,
        };
      }
      throw new AppError("ORGANISATION_MEMBERSHIP_REQUIRED", "Forbidden");
    });

    subscriptionService.getSubscriptionSummary.mockResolvedValue({ plan: { key: "starter" } });
    subscriptionService.startCheckout.mockResolvedValue({ checkoutUrl: "https://checkout.test" });
    subscriptionService.openPortal.mockResolvedValue({ portalUrl: "https://portal.test" });
    subscriptionService.cancelSubscription.mockResolvedValue({});
    subscriptionService.resumeSubscription.mockResolvedValue({});
    subscriptionService.reconcileWithStripe.mockResolvedValue({});
    subscriptionService.listInvoices.mockResolvedValue([]);
  });

  it("rejects cross-tenant billing checkout", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    const response = await POST(
      new NextRequest("http://localhost/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", "x-organisation-id": orgB },
        body: JSON.stringify({ planKey: "starter" }),
      }),
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(subscriptionService.startCheckout).not.toHaveBeenCalled();
  });
});
