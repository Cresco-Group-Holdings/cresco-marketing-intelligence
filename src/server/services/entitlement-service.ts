import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { ENTITLEMENT_TO_METER } from "@/lib/billing/entitlements";
import {
  buildFeatureNotIncludedResult,
  buildLimitExceededResult,
  type EntitlementCheckResult,
} from "@/lib/billing/errors";
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
}> {
  const account = await billingAccountService.getAccount(organisationId);
  if (account.status === "SUSPENDED" || account.status === "CLOSED") {
    return { active: false, trialExpired: false, paymentRequired: false };
  }

  if (account.trial?.status === "ACTIVE" && account.trial.endsAt < new Date()) {
    return { active: false, trialExpired: true, paymentRequired: false };
  }

  const sub = account.subscription;
  if (!sub) return { active: false, trialExpired: false, paymentRequired: false };

  if (sub.status === "PAST_DUE" || sub.status === "UNPAID") {
    return { active: false, trialExpired: false, paymentRequired: true };
  }

  if (["CANCELLED", "PAUSED", "INCOMPLETE"].includes(sub.status)) {
    return { active: false, trialExpired: false, paymentRequired: false };
  }

  return { active: true, trialExpired: false, paymentRequired: false };
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
        upgradePlanKey: "starter",
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
    if (meterKey) {
      const usage = await usageMeteringService.getUsage(input.organisationId, meterKey);
      currentUsage = usage.total;
    }

    if (currentUsage + requested > resolved.limitValue) {
      return buildLimitExceededResult({
        entitlement: input.entitlement,
        currentUsage,
        allowance: resolved.limitValue,
        upgradePlanKey: "professional",
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
};
