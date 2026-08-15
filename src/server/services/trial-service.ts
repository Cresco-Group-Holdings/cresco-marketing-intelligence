import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { getCurrentPlanVersion } from "@/lib/billing/plan-seed";
import { billingAccountService } from "@/server/services/billing-account-service";
import { entitlementService } from "@/server/services/entitlement-service";

export const trialService = {
  async startTrial(organisationId: string, planKey = "trial", trialDays = 14) {
    const account = await billingAccountService.getAccount(organisationId);

    if (account.trial?.status === "ACTIVE") {
      throw new AppError("CONFLICT", "An active trial already exists for this workspace.");
    }

    const planVersion = await getCurrentPlanVersion(planKey);
    if (!planVersion) throw new AppError("NOT_FOUND", "Trial plan not found.");

    const endsAt = new Date();
    endsAt.setUTCDate(endsAt.getUTCDate() + trialDays);

    await prisma.trial.upsert({
      where: { billingAccountId: account.id },
      create: {
        billingAccountId: account.id,
        status: "ACTIVE",
        startedAt: new Date(),
        endsAt,
      },
      update: {
        status: "ACTIVE",
        startedAt: new Date(),
        endsAt,
      },
    });

    await prisma.subscription.update({
      where: { billingAccountId: account.id },
      data: {
        planVersionId: planVersion.id,
        status: "TRIALING",
        trialEnd: endsAt,
      },
    });

    await entitlementService.syncWorkspaceEntitlementsFromPlan(organisationId);

    return { endsAt: endsAt.toISOString(), planKey };
  },

  async expireTrials() {
    const expired = await prisma.trial.findMany({
      where: { status: "ACTIVE", endsAt: { lt: new Date() } },
    });

    for (const trial of expired) {
      await prisma.trial.update({
        where: { id: trial.id },
        data: { status: "EXPIRED" },
      });

      const account = await prisma.billingAccount.findUnique({
        where: { id: trial.billingAccountId },
      });
      if (!account) continue;

      const freePlan = await getCurrentPlanVersion("free");
      if (!freePlan) continue;

      await prisma.subscription.updateMany({
        where: { billingAccountId: trial.billingAccountId },
        data: {
          planVersionId: freePlan.id,
          status: "ACTIVE",
          trialEnd: null,
        },
      });

      await entitlementService.syncWorkspaceEntitlementsFromPlan(account.organisationId);
    }

    return { expired: expired.length };
  },
};
