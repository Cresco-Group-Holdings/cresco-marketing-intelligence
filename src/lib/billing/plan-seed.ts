import { prisma } from "@/lib/database/prisma";
import { DEFAULT_PLAN_CATALOG, USAGE_METER_DEFINITIONS } from "@/lib/billing/plan-catalog";
import { resolveStripePriceId } from "@/lib/billing/commercial-config";

export async function ensureBillingCatalogSeeded() {
  for (const meter of USAGE_METER_DEFINITIONS) {
    await prisma.usageMeter.upsert({
      where: { key: meter.key },
      create: meter,
      update: { displayName: meter.displayName, unit: meter.unit },
    });
  }

  for (const plan of DEFAULT_PLAN_CATALOG) {
    const dbPlan = await prisma.subscriptionPlan.upsert({
      where: { key: plan.key },
      create: {
        key: plan.key,
        displayName: plan.displayName,
        description: plan.description,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
      update: {
        displayName: plan.displayName,
        description: plan.description,
        sortOrder: plan.sortOrder,
      },
    });

    const monthlyPriceRef = resolveStripePriceId(plan.key, "MONTHLY");
    const annualPriceRef = resolveStripePriceId(plan.key, "ANNUAL");

    const existingVersion = await prisma.subscriptionPlanVersion.findFirst({
      where: { planId: dbPlan.id, isCurrent: true },
    });

    if (!existingVersion) {
      const version = await prisma.subscriptionPlanVersion.create({
        data: {
          planId: dbPlan.id,
          version: 1,
          monthlyPriceCents: plan.monthlyPriceCents,
          annualPriceCents: plan.annualPriceCents,
          trialDays: plan.trialDays,
          externalPriceMonthlyRef: monthlyPriceRef,
          externalPriceAnnualRef: annualPriceRef,
          isCurrent: true,
        },
      });

      await prisma.planEntitlement.createMany({
        data: plan.entitlements.map((e) => ({
          planVersionId: version.id,
          entitlementKey: e.entitlementKey,
          valueType: e.valueType,
          limitValue: e.limitValue,
          booleanValue: e.booleanValue,
        })),
        skipDuplicates: true,
      });

      await prisma.usageAllowance.createMany({
        data: plan.allowances.map((a) => ({
          planVersionId: version.id,
          meterKey: a.meterKey,
          allowance: a.allowance,
          period: a.period,
        })),
        skipDuplicates: true,
      });
    } else {
      await prisma.subscriptionPlanVersion.update({
        where: { id: existingVersion.id },
        data: {
          monthlyPriceCents: plan.monthlyPriceCents,
          annualPriceCents: plan.annualPriceCents,
          ...(monthlyPriceRef ? { externalPriceMonthlyRef: monthlyPriceRef } : {}),
          ...(annualPriceRef ? { externalPriceAnnualRef: annualPriceRef } : {}),
        },
      });
    }
  }
}

export async function getCurrentPlanVersion(planKey: string) {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { key: planKey },
    include: {
      versions: {
        where: { isCurrent: true },
        take: 1,
        include: { entitlements: true, allowances: true, plan: true },
      },
    },
  });
  return plan?.versions[0] ?? null;
}
