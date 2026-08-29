import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { ENTITLEMENT_KEYS } from "@/lib/billing/entitlements";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const prismaMock = vi.hoisted(() => ({
  workspaceEntitlement: { findFirst: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
  planEntitlement: { findMany: vi.fn() },
  usageRecord: { aggregate: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  billingAccount: { findUnique: vi.fn(), create: vi.fn() },
  subscription: { update: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
  subscriptionPlan: { findUnique: vi.fn(), findMany: vi.fn() },
  subscriptionPlanVersion: { findFirst: vi.fn(), create: vi.fn() },
  usageMeter: { upsert: vi.fn() },
  usageAllowance: { createMany: vi.fn(), findMany: vi.fn() },
  planEntitlementCreate: vi.fn(),
  billingEvent: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  billingInvoiceReference: { upsert: vi.fn() },
  trial: { findMany: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  providerConnection: { count: vi.fn() },
  brand: { count: vi.fn() },
  organisationMembership: { count: vi.fn() },
  invitation: { count: vi.fn() },
  project: { count: vi.fn() },
  campaign: { count: vi.fn() },
  auditLog: { create: vi.fn() },
}));

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    workspaceEntitlement: prismaMock.workspaceEntitlement,
    planEntitlement: prismaMock.planEntitlement,
    usageRecord: prismaMock.usageRecord,
    billingAccount: prismaMock.billingAccount,
    subscription: prismaMock.subscription,
    subscriptionPlan: prismaMock.subscriptionPlan,
    subscriptionPlanVersion: prismaMock.subscriptionPlanVersion,
    usageMeter: prismaMock.usageMeter,
    usageAllowance: prismaMock.usageAllowance,
    billingEvent: prismaMock.billingEvent,
    billingInvoiceReference: prismaMock.billingInvoiceReference,
    trial: prismaMock.trial,
    providerConnection: prismaMock.providerConnection,
    brand: prismaMock.brand,
    organisationMembership: prismaMock.organisationMembership,
    invitation: prismaMock.invitation,
    project: prismaMock.project,
    campaign: prismaMock.campaign,
    auditLog: prismaMock.auditLog,
  },
}));

vi.mock("@/lib/billing/plan-seed", () => ({
  ensureBillingCatalogSeeded: vi.fn().mockResolvedValue(undefined),
  getCurrentPlanVersion: vi.fn().mockResolvedValue({ id: "pv-starter", plan: { key: "starter" } }),
}));

vi.mock("@/server/providers/billing/stripe-billing-provider", () => ({
  getStripeBillingConfig: vi.fn().mockReturnValue({
    secretKey: "sk_test",
    webhookSecret: "whsec_test",
  }),
}));

vi.mock("@/lib/providers/oauth/runtime", () => ({
  isProductionRuntime: vi.fn().mockReturnValue(false),
}));

import { createHmac } from "node:crypto";
import { getStripeBillingConfig } from "@/server/providers/billing/stripe-billing-provider";
import { isProductionRuntime } from "@/lib/providers/oauth/runtime";

import { entitlementService } from "@/server/services/entitlement-service";
import { billingWebhookService } from "@/server/services/billing-webhook-service";
import { usageMeteringService } from "@/server/services/usage-metering-service";
import { trialService } from "@/server/services/trial-service";

const organisationId = "org-1";

function signStripePayload(payload: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", "whsec_test").update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

function activeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "ba-1",
    organisationId,
    status: "ACTIVE",
    subscription: {
      planVersionId: "pv-free",
      status: "ACTIVE",
      currentPeriodStart: new Date("2026-08-01"),
      currentPeriodEnd: new Date("2026-09-01"),
      planVersion: { plan: { key: "free" } },
    },
    trial: null,
    ...overrides,
  };
}

describe("billing permissions", () => {
  it("restricts billing management to admin roles", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["billing.manage"])).toBe(false);
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["billing.manage"])).toBe(true);
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["billing.read"])).toBe(true);
  });
});

describe("entitlementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.billingAccount.findUnique.mockResolvedValue(activeAccount());
    prismaMock.workspaceEntitlement.findFirst.mockResolvedValue(null);
    prismaMock.planEntitlement.findMany.mockResolvedValue([
      {
        entitlementKey: ENTITLEMENT_KEYS.PROVIDER_CONNECTIONS_MAX,
        valueType: "COUNT",
        limitValue: 2,
        booleanValue: null,
      },
    ]);
    prismaMock.providerConnection.count.mockResolvedValue(2);
  });

  it("blocks when plan limit is exceeded", async () => {
    const result = await entitlementService.check({
      workspaceId: organisationId,
      organisationId,
      entitlement: ENTITLEMENT_KEYS.PROVIDER_CONNECTIONS_MAX,
      requestedAmount: 1,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("PLAN_LIMIT_EXCEEDED");
    expect(result.currentUsage).toBe(2);
    expect(result.allowance).toBe(2);
  });

  it("allows when under limit", async () => {
    prismaMock.providerConnection.count.mockResolvedValue(1);

    const result = await entitlementService.check({
      workspaceId: organisationId,
      organisationId,
      entitlement: ENTITLEMENT_KEYS.PROVIDER_CONNECTIONS_MAX,
      requestedAmount: 1,
    });

    expect(result.allowed).toBe(true);
  });

  it("returns FEATURE_NOT_INCLUDED for missing entitlements", async () => {
    prismaMock.planEntitlement.findMany.mockResolvedValue([]);

    const result = await entitlementService.check({
      workspaceId: organisationId,
      organisationId,
      entitlement: ENTITLEMENT_KEYS.API_ACCESS,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("FEATURE_NOT_INCLUDED");
  });

  it("returns TRIAL_EXPIRED when trial ended", async () => {
    prismaMock.billingAccount.findUnique.mockResolvedValue(
      activeAccount({
        trial: { status: "ACTIVE", endsAt: new Date("2026-01-01") },
      }),
    );

    const result = await entitlementService.check({
      workspaceId: organisationId,
      organisationId,
      entitlement: ENTITLEMENT_KEYS.USERS_MAX,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("TRIAL_EXPIRED");
  });

  it("returns PAYMENT_ACTION_REQUIRED for past due subscriptions after grace period", async () => {
    const pastDueSince = new Date();
    pastDueSince.setUTCDate(pastDueSince.getUTCDate() - 10);

    prismaMock.billingAccount.findUnique.mockResolvedValue(
      activeAccount({
        subscription: {
          planVersionId: "pv-free",
          status: "PAST_DUE",
          updatedAt: pastDueSince,
          currentPeriodStart: new Date("2026-08-01"),
          currentPeriodEnd: new Date("2026-09-01"),
          planVersion: { plan: { key: "starter" } },
        },
      }),
    );
    prismaMock.planEntitlement.findMany.mockResolvedValue([
      {
        entitlementKey: ENTITLEMENT_KEYS.USERS_MAX,
        valueType: "COUNT",
        limitValue: 5,
        booleanValue: null,
      },
    ]);

    const result = await entitlementService.check({
      workspaceId: organisationId,
      organisationId,
      entitlement: ENTITLEMENT_KEYS.USERS_MAX,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("PAYMENT_ACTION_REQUIRED");
  });
});

describe("usageMeteringService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.billingAccount.findUnique.mockResolvedValue(activeAccount());
    prismaMock.usageRecord.findUnique.mockResolvedValue(null);
    prismaMock.usageRecord.create.mockResolvedValue({});
  });

  it("deduplicates usage records by idempotency key", async () => {
    prismaMock.usageRecord.findUnique.mockResolvedValue({ id: "existing" });

    const result = await usageMeteringService.recordUsage({
      organisationId,
      meterKey: "ai.tokens",
      amount: 100,
      idempotencyKey: "run-1",
    });

    expect(result.duplicate).toBe(true);
    expect(prismaMock.usageRecord.create).not.toHaveBeenCalled();
  });

  it("records usage when idempotency key is new", async () => {
    const result = await usageMeteringService.recordUsage({
      organisationId,
      meterKey: "ai.tokens",
      amount: 100,
      idempotencyKey: "run-2",
    });

    expect(result.recorded).toBe(true);
    expect(prismaMock.usageRecord.create).toHaveBeenCalled();
  });
});

describe("billingWebhookService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.billingEvent.findUnique.mockResolvedValue(null);
    prismaMock.billingEvent.create.mockResolvedValue({ id: "evt-1" });
    prismaMock.billingEvent.update.mockResolvedValue({});
    prismaMock.billingAccount.findUnique.mockResolvedValue(activeAccount());
    prismaMock.subscription.upsert.mockResolvedValue({});
    prismaMock.workspaceEntitlement.upsert.mockResolvedValue({});
    prismaMock.planEntitlement.findMany.mockResolvedValue([]);
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-1" });
  });

  it("deduplicates webhook replay", async () => {
    prismaMock.billingEvent.findUnique.mockResolvedValue({ id: "evt-old", status: "PROCESSED" });

    const payload = JSON.stringify({
      id: "evt_stripe_1",
      type: "checkout.session.completed",
      data: { object: { metadata: { organisation_id: organisationId }, subscription: "sub_1" } },
    });

    const result = await billingWebhookService.processStripeEvent(payload, signStripePayload(payload));
    expect(result.duplicate).toBe(true);
    expect(prismaMock.billingEvent.create).not.toHaveBeenCalled();
  });

  it("processes checkout.session.completed", async () => {
    const payload = JSON.stringify({
      id: "evt_stripe_2",
      type: "checkout.session.completed",
      data: { object: { metadata: { organisation_id: organisationId, plan_key: "starter" }, subscription: "sub_2" } },
    });

    const result = await billingWebhookService.processStripeEvent(payload, signStripePayload(payload));
    expect(result.duplicate).toBe(false);
    expect(prismaMock.subscription.upsert).toHaveBeenCalled();
  });

  it("marks subscription past due on payment failure", async () => {
    const payload = JSON.stringify({
      id: "evt_stripe_3",
      type: "invoice.payment_failed",
      data: { object: { metadata: { organisation_id: organisationId } } },
    });

    await billingWebhookService.processStripeEvent(payload, signStripePayload(payload));
    expect(prismaMock.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PAST_DUE" } }),
    );
  });

  it("rejects webhooks when Stripe billing is not configured in production", async () => {
    vi.mocked(getStripeBillingConfig).mockReturnValueOnce(null);
    vi.mocked(isProductionRuntime).mockReturnValueOnce(true);
    const payload = JSON.stringify({ id: "evt_bad", type: "checkout.session.completed", data: { object: {} } });
    await expect(
      billingWebhookService.processStripeEvent(payload, signStripePayload(payload)),
    ).rejects.toThrow(/not configured/i);
  });
});

describe("trialService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.billingAccount.findUnique.mockResolvedValue(activeAccount({ trial: null }));
    prismaMock.trial.upsert.mockResolvedValue({});
    prismaMock.subscription.update.mockResolvedValue({});
    prismaMock.workspaceEntitlement.upsert.mockResolvedValue({});
    prismaMock.planEntitlement.findMany.mockResolvedValue([]);
  });

  it("starts a trial for a workspace", async () => {
    const result = await trialService.startTrial(organisationId);
    expect(result.planKey).toBe("trial");
    expect(prismaMock.trial.upsert).toHaveBeenCalled();
    expect(prismaMock.subscription.update).toHaveBeenCalled();
  });
});
