import { prisma } from "@/lib/database/prisma";
import { ensureBillingCatalogSeeded, getCurrentPlanVersion } from "@/lib/billing/plan-seed";

export const billingAccountService = {
  async ensureAccount(organisationId: string, billingEmail?: string) {
    await ensureBillingCatalogSeeded();

    const account = await prisma.billingAccount.findUnique({
      where: { organisationId },
      include: {
        subscription: {
          include: { planVersion: { include: { plan: true } } },
        },
        trial: true,
      },
    });
    if (account) return account;

    const freePlan = await getCurrentPlanVersion("free");
    if (!freePlan) throw new Error("Free plan not seeded.");

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

    return prisma.billingAccount.create({
      data: {
        workspaceId: organisationId,
        organisationId,
        billingEmail,
        subscription: {
          create: {
            planVersionId: freePlan.id,
            status: "ACTIVE",
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        },
      },
      include: { subscription: { include: { planVersion: { include: { plan: true } } } }, trial: true },
    });
  },

  async getAccount(organisationId: string) {
    return this.ensureAccount(organisationId);
  },
};
