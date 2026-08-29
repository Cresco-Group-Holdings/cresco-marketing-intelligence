import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { ENTITLEMENT_KEYS, ENTITLEMENT_TO_METER } from "@/lib/billing/entitlements";
import {
  buildFeatureNotIncludedResult,
  buildLimitExceededResult,
  type EntitlementCheckResult,
} from "@/lib/billing/errors";
import { suggestUpgradePlanKey } from "@/lib/billing/commercial-config";
import { isCommercialUsageExempt } from "@/lib/billing/commercial-exempt";
import { normalizeSubscriptionAccess } from "@/lib/billing/subscription-state";
import { usageReservationService } from "@/lib/billing/usage-reservation";
import { billingAccountService } from "@/server/services/billing-account-service";
import { usageMeteringService } from "@/server/services/usage-metering-service";

export type EntitlementCheckInput = {
  workspaceId: string;
  organisationId: string;
  entitlement: string;
  requestedAmount?: number;
};

async function isSubscriptionActive(organisationId: string): Promise<{
  active: boolean;
  trialExpired: boolean;
  paymentRequired: boolean;
  inGracePeriod: boolean;
  planKey: string;
}> {
  const account = await billingAccountService.getAccount(organisationId);
  if (account.status === "SUSPENDED" || account.status === "CLOSED") {
    return { active: false, trialExpired: false, paymentRequired: false, inGracePeriod: false, planKey: "free" };
  }

  const planKey = account.subscription?.planVersion.plan.key ?? "free";

  if (account.trial?.status === "ACTIVE" && account.trial.endsAt < new Date()) {
    return { active: false, trialExpired: true, paymentRequired: false, inGracePeriod: false, planKey };
  }

  const sub = account.subscription;
  if (!sub) return { active: false, trialExpired: false, paymentRequired: false, inGracePeriod: false, planKey };

  const access = normalizeSubscriptionAccess({
    status: sub.status,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    pastDueSince: sub.status === "PAST_DUE" ? sub.updatedAt : null,
    trialEndsAt: sub.trialEnd,
  });

  return {
    active: access.entitlementsActive,
    trialExpired: false,
    paymentRequired: access.paymentActionRequired && !access.inGracePeriod,
    inGracePeriod: access.inGracePeriod,
    planKey,
  };
}

async function resolveCountBasedUsage(
  organisationId: string,
  entitlementKey: string,
): Promise<number | null> {
  switch (entitlementKey) {
    case ENTITLEMENT_KEYS.PROVIDER_CONNECTIONS_MAX:
      return prisma.providerConnection.count({
        where: {
          organisationId,
          status: { in: ["CONNECTED", "REAUTH_REQUIRED", "ACTION_REQUIRED", "DEGRADED"] },
        },
      });
    case ENTITLEMENT_KEYS.BRANDS_MAX:
      return prisma.brand.count({
        where: { organisationId, status: { not: "ARCHIVED" } },
      });
    case ENTITLEMENT_KEYS.USERS_MAX: {
      const [members, pendingInvites] = await Promise.all([
        prisma.organisationMembership.count({
          where: { organisationId, status: "ACTIVE" },
        }),
        prisma.invitation.count({
          where: { organisationId, status: "PENDING" },
        }),
      ]);
      return members + pendingInvites;
    }
    case ENTITLEMENT_KEYS.PROJECTS_MAX:
      return prisma.project.count({ where: { organisationId } });
    case ENTITLEMENT_KEYS.CAMPAIGNS_MAX_ACTIVE:
      return prisma.campaign.count({
        where: { organisationId, status: "ACTIVE", archivedAt: null },
      });
    default:
      return null;
  }
}

async function resolveEntitlementLimit(
  organisationId: string,
  entitlementKey: string,
): Promise<{ valueType: string; limitValue: number | null; booleanValue: boolean | null } | null> {
  const override = await prisma.workspaceEntitlement.findFirst({
    where: {
      organisationId,
      entitlementKey,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { updatedAt: "desc" },
  });
  if (override) {
    return {
      valueType: override.valueType,
      limitValue: override.limitValue,
      booleanValue: override.booleanValue,
    };
  }

  const account = await billingAccountService.getAccount(organisationId);
  const planEntitlements = await prisma.planEntitlement.findMany({
    where: { planVersionId: account.subscription!.planVersionId },
  });
  const match = planEntitlements.find((e) => e.entitlementKey === entitlementKey);
  if (!match) return null;

  return {
    valueType: match.valueType,
    limitValue: match.limitValue,
    booleanValue: match.booleanValue,
  };
}

export const entitlementService = {
  async check(input: EntitlementCheckInput): Promise<EntitlementCheckResult> {
    const requested = input.requestedAmount ?? 1;
    const subscriptionState = await isSubscriptionActive(input.organisationId);

    if (subscriptionState.trialExpired) {
      return {
        allowed: false,
        code: "TRIAL_EXPIRED",
        message: "Your trial has expired. Upgrade to continue.",
        entitlement: input.entitlement,
        upgradePlanKey: suggestUpgradePlanKey(subscriptionState.planKey) ?? "starter",
      };
    }
    if (subscriptionState.paymentRequired) {
      return {
        allowed: false,
        code: "PAYMENT_ACTION_REQUIRED",
        message: "Payment action is required to restore access.",
        entitlement: input.entitlement,
      };
    }
    if (!subscriptionState.active) {
      return {
        allowed: false,
        code: "SUBSCRIPTION_INACTIVE",
        message: "Subscription is not active.",
        entitlement: input.entitlement,
      };
    }

    const resolved = await resolveEntitlementLimit(input.organisationId, input.entitlement);
    if (!resolved) {
      return buildFeatureNotIncludedResult(input.entitlement);
    }

    if (resolved.valueType === "BOOLEAN") {
      if (!resolved.booleanValue) {
        return buildFeatureNotIncludedResult(input.entitlement);
      }
      return { allowed: true, entitlement: input.entitlement };
    }

    if (resolved.limitValue === null) {
      return { allowed: true, entitlement: input.entitlement, allowance: null };
    }

    const meterKey = ENTITLEMENT_TO_METER[input.entitlement as keyof typeof ENTITLEMENT_TO_METER];
    let currentUsage = 0;
    const countBased = await resolveCountBasedUsage(input.organisationId, input.entitlement);
    if (countBased !== null) {
      currentUsage = countBased;
    } else if (meterKey) {
      const usage = await usageReservationService.getReservedUsage(
        input.organisationId,
        meterKey,
        "BILLING_PERIOD",
      );
      currentUsage = usage;
    }

    if (currentUsage + requested > resolved.limitValue) {
      return buildLimitExceededResult({
        entitlement: input.entitlement,
        currentUsage,
        allowance: resolved.limitValue,
        upgradePlanKey: suggestUpgradePlanKey(subscriptionState.planKey),
      });
    }

    return {
      allowed: true,
      entitlement: input.entitlement,
      currentUsage,
      allowance: resolved.limitValue,
    };
  },

  async assert(input: EntitlementCheckInput) {
    const result = await this.check(input);
    if (!result.allowed) {
      throw new AppError(result.code ?? "PLAN_LIMIT_EXCEEDED", result.message ?? "Plan limit exceeded.", {
        status: result.code === "PAYMENT_ACTION_REQUIRED" ? 402 : undefined,
      });
    }
    return result;
  },

  async reserveMeteredUsage(input: {
    organisationId: string;
    entitlement: string;
    meterKey: string;
    amount: number;
    idempotencyKey: string;
    operationType?: string;
  }) {
    if (isCommercialUsageExempt(input.organisationId)) {
      return { reserved: true, exempt: true, duplicate: false, reservationId: "exempt" };
    }

    const check = await this.check({
      workspaceId: input.organisationId,
      organisationId: input.organisationId,
      entitlement: input.entitlement,
      requestedAmount: input.amount,
    });
    if (!check.allowed || check.allowance == null) {
      throw new AppError(check.code ?? "PLAN_LIMIT_EXCEEDED", check.message ?? "Plan limit exceeded.", {
        status: check.code === "PAYMENT_ACTION_REQUIRED" ? 402 : 403,
      });
    }

    return usageReservationService.reserve({
      organisationId: input.organisationId,
      meterKey: input.meterKey,
      amount: input.amount,
      idempotencyKey: input.idempotencyKey,
      allowance: check.allowance,
      period: "BILLING_PERIOD",
      operationType: input.operationType,
    });
  },

  async syncWorkspaceEntitlementsFromPlan(organisationId: string) {
    const account = await billingAccountService.getAccount(organisationId);
    const entitlements = await prisma.planEntitlement.findMany({
      where: { planVersionId: account.subscription!.planVersionId },
    });

    for (const entitlement of entitlements) {
      await prisma.workspaceEntitlement.upsert({
        where: {
          organisationId_entitlementKey_source: {
            organisationId,
            entitlementKey: entitlement.entitlementKey,
            source: "PLAN",
          },
        },
        create: {
          workspaceId: organisationId,
          organisationId,
          entitlementKey: entitlement.entitlementKey,
          valueType: entitlement.valueType,
          limitValue: entitlement.limitValue,
          booleanValue: entitlement.booleanValue,
          source: "PLAN",
        },
        update: {
          valueType: entitlement.valueType,
          limitValue: entitlement.limitValue,
          booleanValue: entitlement.booleanValue,
        },
      });
    }
  },

  async listEntitlements(organisationId: string) {
    await this.syncWorkspaceEntitlementsFromPlan(organisationId);
    return prisma.workspaceEntitlement.findMany({
      where: { organisationId, source: "PLAN" },
      orderBy: { entitlementKey: "asc" },
    });
  },

  async resolveEntitlements(organisationId: string) {
    const account = await billingAccountService.getAccount(organisationId);
    const subscriptionState = await isSubscriptionActive(organisationId);
    const entitlements = await this.listEntitlements(organisationId);
    const usage = await usageMeteringService.getUsageOverview(organisationId);

    return {
      organisationId,
      planKey: account.subscription?.planVersion.plan.key ?? "free",
      planDisplayName: account.subscription?.planVersion.plan.displayName ?? "Free",
      subscriptionStatus: account.subscription?.status ?? "ACTIVE",
      productAccess: subscriptionState,
      entitlements,
      usage,
      warnings: usage
        .filter((meter) => meter.allowance > 0)
        .map((meter) => {
          const pct = (meter.used / meter.allowance) * 100;
          if (pct >= 100) return { meterKey: meter.meterKey, level: "limit" as const, percent: pct };
          if (pct >= 90) return { meterKey: meter.meterKey, level: "critical" as const, percent: pct };
          if (pct >= 70) return { meterKey: meter.meterKey, level: "warning" as const, percent: pct };
          return null;
        })
        .filter(Boolean),
    };
  },
};
