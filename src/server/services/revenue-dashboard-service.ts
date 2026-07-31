import { prisma } from "@/lib/database/prisma";
import { buildCohortResults } from "@/lib/revenue/cohorts";
import { FORMULA_DEFINITIONS, REVENUE_DISCLAIMER } from "@/lib/revenue/constants";
import { DEFAULT_REPORTING_CURRENCY } from "@/lib/revenue/config";
import { calculateRevenueMetrics } from "@/lib/revenue/metrics";
import { listAvailableRevenueAdapters } from "@/lib/revenue/adapters";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

export const revenueDashboardService = {
  async getOverview(brandId: string, organisationId: string, from: Date, to: Date, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);

    const transactions = await prisma.revenueTransaction.findMany({
      where: { brandId, organisationId, occurredAt: { gte: from, lte: to } },
      include: { revenueCustomer: true },
    });

    const subscriptions = await prisma.revenueSubscription.findMany({
      where: { brandId, organisationId, status: { in: ["ACTIVE", "TRIALING"] } },
    });

    const costRecords = await prisma.marketingCostRecord.aggregate({
      where: { brandId, organisationId, periodStart: { gte: from, lte: to } },
      _sum: { amount: true },
    });

    const customerFirstPayments = new Map<string, Date>();
    for (const tx of transactions) {
      if (!tx.revenueCustomerId) continue;
      const existing = customerFirstPayments.get(tx.revenueCustomerId);
      if (!existing || tx.occurredAt < existing) {
        customerFirstPayments.set(tx.revenueCustomerId, tx.occurredAt);
      }
    }

    const metrics = calculateRevenueMetrics({
      transactions: transactions.map((tx) => ({
        originalAmount: Number(tx.originalAmount),
        netAmount: Number(tx.netAmount),
        currency: tx.currency,
        occurredAt: tx.occurredAt,
        transactionType: tx.transactionType,
        isRefund: tx.isRefund,
        revenueCustomerId: tx.revenueCustomerId,
        customerFirstPaymentAt: tx.revenueCustomerId
          ? customerFirstPayments.get(tx.revenueCustomerId)
          : null,
      })),
      subscriptions: subscriptions.map((s) => ({
        mrrAmount: Number(s.mrrAmount ?? 0),
        status: s.status,
        currency: s.currency,
      })),
      marketingSpend: Number(costRecords._sum.amount ?? 0),
      newCustomers: customerFirstPayments.size,
    });

    const lastSync = await prisma.revenueSyncRun.findFirst({
      where: { brandId, organisationId, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
    });

    const currencies = [...new Set(transactions.map((t) => t.currency))];

    return {
      metrics,
      originalCurrencies: currencies,
      reportingCurrency: DEFAULT_REPORTING_CURRENCY,
      dataFreshness: lastSync?.lastSyncedAt?.toISOString() ?? null,
      revenueSources: listAvailableRevenueAdapters(),
      disclaimer: REVENUE_DISCLAIMER,
      formulaDefinitions: FORMULA_DEFINITIONS,
    };
  },

  async getCustomers(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const customers = await prisma.revenueCustomer.findMany({
      where: { brandId, organisationId, isDeleted: false },
      include: {
        marketingIdentity: true,
        identityLinks: true,
        subscriptions: { where: { status: { in: ["ACTIVE", "TRIALING"] } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return customers.map((c) => ({
      id: c.id,
      sourceType: c.sourceType,
      providerCustomerId: c.providerCustomerId,
      displayName: c.displayName,
      country: c.country,
      acquisitionChannel: c.acquisitionChannel,
      campaign: c.campaign,
      identityLinked: Boolean(c.marketingIdentityId),
      identityId: c.marketingIdentityId,
      activeSubscriptions: c.subscriptions.length,
      originalCurrency: c.originalCurrency ?? c.subscriptions[0]?.currency,
      signupAt: c.signupAt?.toISOString() ?? null,
    }));
  },

  async getSubscriptions(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.revenueSubscription.findMany({
      where: { brandId, organisationId },
      include: { revenueCustomer: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  },

  async getCohorts(brandId: string, organisationId: string, from: Date, to: Date, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const customers = await prisma.revenueCustomer.findMany({
      where: { brandId, organisationId, isDeleted: false, signupAt: { gte: from, lte: to } },
      include: { transactions: true },
    });

    const cohortCustomers = customers.map((c) => ({
      customerId: c.id,
      signupAt: c.signupAt ?? c.createdAt,
      totalRevenue: c.transactions.reduce((sum, t) => sum + Number(t.netAmount), 0),
      dimensionValues: {
        SIGNUP_MONTH: (c.signupAt ?? c.createdAt).toISOString().slice(0, 7),
        ACQUISITION_CHANNEL: c.acquisitionChannel ?? undefined,
        CAMPAIGN: c.campaign ?? undefined,
        COUNTRY: c.country ?? undefined,
        CUSTOMER_TYPE: c.customerType ?? undefined,
      } as Record<string, string>,
    }));

    return buildCohortResults(cohortCustomers, "SIGNUP_MONTH");
  },

  async getUnitEconomics(brandId: string, organisationId: string, from: Date, to: Date, context: TenantContext) {
    const overview = await this.getOverview(brandId, organisationId, from, to, context);
    return {
      ...overview.metrics,
      reportingCurrency: overview.reportingCurrency,
      formulaDefinitions: overview.formulaDefinitions,
      disclaimer: overview.disclaimer,
      grossMarginExtensionPoint:
        "Gross margin can be configured per brand to enable payback period calculations.",
      chargebackExtensionPoint: "Chargeback handling reserved for future provider integration.",
      ltvExtensionPoint: "Configure ltvMethodology to enable LTV calculation.",
    };
  },

  async getWarnings(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const unattributed = await prisma.revenueTransaction.count({
      where: { brandId, organisationId, revenueCustomerId: null },
    });
    const unlinked = await prisma.revenueCustomer.count({
      where: { brandId, organisationId, marketingIdentityId: null, isDeleted: false },
    });

    return {
      warnings: [
        ...(unattributed > 0
          ? [{ level: "warning", message: `${unattributed} transactions lack customer attribution.` }]
          : []),
        ...(unlinked > 0
          ? [{ level: "info", message: `${unlinked} revenue customers are not linked to marketing identities.` }]
          : []),
      ],
    };
  },
};
