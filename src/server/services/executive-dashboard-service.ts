import type { ExecutiveComparisonType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import {
  buildExecutiveCacheKey,
  getExecutiveCache,
  setExecutiveCache,
} from "@/lib/executive/cache";
import { computeDateRanges } from "@/lib/executive/comparisons";
import {
  EXECUTIVE_DISCLAIMER,
  EXECUTIVE_FORMULA_DEFINITIONS,
  EMAIL_PERFORMANCE_EXTENSION,
} from "@/lib/executive/constants";
import { availableMetric, compareMetrics, unavailableMetric } from "@/lib/executive/metric-value";
import {
  calculateObjectiveProgress,
  resolveObjectiveActual,
  type ObjectiveKpiSnapshot,
} from "@/lib/executive/objective-kpis";
import type {
  DataConfidence,
  ExecutiveFilters,
  ExecutiveSection,
  MetricComparison,
  SectionResult,
} from "@/lib/executive/types";

export type ExecutiveOverviewPayload = {
  kpis: Record<string, MetricComparison>;
  period: {
    from: string;
    to: string;
    comparisonFrom: string;
    comparisonTo: string;
    comparisonType: ExecutiveComparisonType;
  };
  reportingCurrency: string;
  disclaimer: string;
  formulaDefinitions: typeof EXECUTIVE_FORMULA_DEFINITIONS;
  extensionPoints: { emailPerformance: string };
};
import { QUALIFIED_LEAD_STATUSES } from "@/lib/leads/constants";
import { DEFAULT_REPORTING_CURRENCY } from "@/lib/revenue/config";
import type { TenantContext } from "@/lib/tenancy/context";
import { attributionDashboardService } from "@/server/services/attribution-dashboard-service";
import { funnelDashboardService } from "@/server/services/funnel-dashboard-service";
import { gscDashboardService } from "@/server/services/gsc-dashboard-service";
import { marketingWarehouseHealthService } from "@/server/services/marketing-warehouse-health-service";
import { paidAdsDashboardService } from "@/server/services/paid-ads-dashboard-service";
import { revenueDashboardService } from "@/server/services/revenue-dashboard-service";
import { socialAnalyticsQueryService } from "@/server/services/social-analytics-query-service";
import { brandService } from "@/server/services/workspace-service";
import { listAvailableRevenueAdapters } from "@/lib/revenue/adapters";

type PeriodKpis = ObjectiveKpiSnapshot & {
  conversionRate: ReturnType<typeof buildConversionRate>;
  cac: ReturnType<typeof buildCac>;
  ltv: ReturnType<typeof buildLtv>;
  attributedRevenue: ReturnType<typeof buildAttributedRevenue>;
  paidTraffic: ReturnType<typeof buildPaidTraffic>;
  emailPerformance: ReturnType<typeof buildEmailExtension>;
};

async function safeSection<T>(
  name: string,
  loader: () => Promise<T>,
): Promise<SectionResult<T>> {
  try {
    const data = await loader();
    return { data, error: null, confidence: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : `${name} is temporarily unavailable.`,
      confidence: null,
    };
  }
}

async function sumWarehouseMetric(
  brandId: string,
  organisationId: string,
  metricKey: string,
  from: Date,
  to: Date,
) {
  const result = await prisma.marketingMetricObservation.aggregate({
    where: {
      brandId,
      organisationId,
      metricKey,
      observedAt: { gte: from, lte: to },
    },
    _sum: { metricValue: true },
  });
  const value = Number(result._sum.metricValue ?? 0);
  return value > 0 ? value : null;
}

function buildConversionRate(visitors: ReturnType<typeof availableMetric>, customers: ReturnType<typeof availableMetric>) {
  if (!visitors.available || !customers.available || visitors.value == null || customers.value == null || visitors.value === 0) {
    return unavailableMetric("Requires both visitors and customers.");
  }
  return availableMetric((customers.value / visitors.value) * 100, {
    formula: EXECUTIVE_FORMULA_DEFINITIONS.conversionRate,
  });
}

function buildCac(spend: ReturnType<typeof availableMetric>, customers: ReturnType<typeof availableMetric>) {
  if (!spend.available || !customers.available || spend.value == null || customers.value == null || customers.value === 0) {
    return unavailableMetric("Requires marketing spend and new customers.");
  }
  return availableMetric(spend.value / customers.value, {
    currency: spend.currency,
    formula: EXECUTIVE_FORMULA_DEFINITIONS.cac,
  });
}

function buildLtv() {
  return unavailableMetric("LTV requires an explicit methodology.", {
    formula: EXECUTIVE_FORMULA_DEFINITIONS.ltv,
  });
}

function buildAttributedRevenue(value: number | null, source: string, lastUpdated: string | null) {
  if (value == null) return unavailableMetric("No attribution results in period.");
  return availableMetric(value, {
    source,
    lastUpdated,
    formula: EXECUTIVE_FORMULA_DEFINITIONS.attributedRevenue,
  });
}

function buildPaidTraffic(value: number | null, source: string) {
  if (value == null) return unavailableMetric("No paid advertising data synced.");
  return availableMetric(value, { source, formula: EXECUTIVE_FORMULA_DEFINITIONS.paidTraffic });
}

function buildEmailExtension() {
  return unavailableMetric(EMAIL_PERFORMANCE_EXTENSION);
}

async function loadPeriodKpis(
  brandId: string,
  organisationId: string,
  from: Date,
  to: Date,
  context: TenantContext,
  reportingCurrency: string,
): Promise<PeriodKpis> {
  const [
    visitorsRaw,
    leadsCount,
    qualifiedCount,
    trialsCount,
    revenueOverview,
    attributionOverview,
    paidOverview,
    gscOverview,
    socialOverview,
    costAgg,
    newCustomersCount,
  ] = await Promise.all([
    sumWarehouseMetric(brandId, organisationId, "sessions", from, to),
    prisma.marketingLead.count({
      where: {
        brandId,
        organisationId,
        status: { not: "DELETED" },
        createdAt: { gte: from, lte: to },
      },
    }),
    prisma.marketingLead.count({
      where: {
        brandId,
        organisationId,
        status: { in: QUALIFIED_LEAD_STATUSES },
        createdAt: { gte: from, lte: to },
      },
    }),
    prisma.revenueSubscription.count({
      where: { brandId, organisationId, status: "TRIALING" },
    }),
    revenueDashboardService.getOverview(brandId, organisationId, from, to, context).catch(() => null),
    attributionDashboardService.getOverview(brandId, organisationId, from, to, context).catch(() => null),
    paidAdsDashboardService.getOverview(brandId, organisationId, from, to, context).catch(() => null),
    gscDashboardService.getOverview(brandId, organisationId, from, to, context).catch(() => null),
    socialAnalyticsQueryService
      .overview(brandId, organisationId, { from, to }, context)
      .catch(() => null),
    prisma.marketingCostRecord.aggregate({
      where: { brandId, organisationId, periodStart: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
    prisma.revenueCustomer.count({
      where: {
        brandId,
        organisationId,
        isDeleted: false,
        signupAt: { gte: from, lte: to },
      },
    }),
  ]);

  const visitors = visitorsRaw != null
    ? availableMetric(visitorsRaw, { source: "GA4 / first-party tracking", formula: EXECUTIVE_FORMULA_DEFINITIONS.visitors })
    : unavailableMetric("No visitor data synced.", { formula: EXECUTIVE_FORMULA_DEFINITIONS.visitors });

  const leads = leadsCount > 0
    ? availableMetric(leadsCount, { source: "Marketing leads", formula: EXECUTIVE_FORMULA_DEFINITIONS.leads })
    : unavailableMetric("No leads in period.", { formula: EXECUTIVE_FORMULA_DEFINITIONS.leads });

  const qualifiedLeads = qualifiedCount > 0
    ? availableMetric(qualifiedCount, { source: "Marketing leads", formula: EXECUTIVE_FORMULA_DEFINITIONS.qualifiedLeads })
    : unavailableMetric("No qualified leads in period.", { formula: EXECUTIVE_FORMULA_DEFINITIONS.qualifiedLeads });

  const customers = newCustomersCount > 0
    ? availableMetric(newCustomersCount, {
        source: "Revenue customers",
        lastUpdated: revenueOverview?.dataFreshness ?? null,
        currency: reportingCurrency,
        formula: EXECUTIVE_FORMULA_DEFINITIONS.customers,
      })
    : unavailableMetric("No customer data.", { formula: EXECUTIVE_FORMULA_DEFINITIONS.customers });

  const signups = newCustomersCount > 0
    ? availableMetric(newCustomersCount, { source: "Revenue customers", formula: EXECUTIVE_FORMULA_DEFINITIONS.signups })
    : unavailableMetric("No signups in period.", { formula: EXECUTIVE_FORMULA_DEFINITIONS.signups });

  const trials = trialsCount > 0
    ? availableMetric(trialsCount, { source: "Revenue subscriptions", formula: EXECUTIVE_FORMULA_DEFINITIONS.trials })
    : unavailableMetric("No active trials.", { formula: EXECUTIVE_FORMULA_DEFINITIONS.trials });

  const spendValue = Number(costAgg._sum.amount ?? 0);
  const marketingSpend = spendValue > 0
    ? availableMetric(spendValue, { currency: reportingCurrency, source: "Marketing cost records", formula: EXECUTIVE_FORMULA_DEFINITIONS.marketingSpend })
    : unavailableMetric("No marketing spend recorded.", { formula: EXECUTIVE_FORMULA_DEFINITIONS.marketingSpend });

  const revenue = revenueOverview
    ? availableMetric(revenueOverview.metrics.netRevenue, {
        currency: reportingCurrency,
        source: "Revenue",
        lastUpdated: revenueOverview.dataFreshness,
        formula: EXECUTIVE_FORMULA_DEFINITIONS.revenue,
      })
    : unavailableMetric("No revenue data synced.", { formula: EXECUTIVE_FORMULA_DEFINITIONS.revenue });

  const mrr = revenueOverview
    ? availableMetric(revenueOverview.metrics.mrr, {
        currency: reportingCurrency,
        source: "Revenue subscriptions",
        lastUpdated: revenueOverview.dataFreshness,
        formula: EXECUTIVE_FORMULA_DEFINITIONS.mrr,
      })
    : unavailableMetric("No subscription data.", { formula: EXECUTIVE_FORMULA_DEFINITIONS.mrr });

  const organicTraffic = gscOverview && gscOverview.clicks > 0
    ? availableMetric(gscOverview.clicks, {
        source: "Google Search Console",
        lastUpdated: gscOverview.freshness.lastSyncedDate,
        formula: EXECUTIVE_FORMULA_DEFINITIONS.organicTraffic,
      })
    : unavailableMetric("No search data synced.", { formula: EXECUTIVE_FORMULA_DEFINITIONS.organicTraffic });

  const socialTotals = socialOverview?.totals ?? {};
  const engagement =
    (socialTotals.likes ?? 0) +
    (socialTotals.comments ?? 0) +
    (socialTotals.shares ?? 0) +
    (socialTotals.saves ?? 0);
  const socialEngagement = engagement > 0
    ? availableMetric(engagement, { source: "Social analytics", formula: EXECUTIVE_FORMULA_DEFINITIONS.socialEngagement })
    : unavailableMetric("No social engagement data.", { formula: EXECUTIVE_FORMULA_DEFINITIONS.socialEngagement });

  const attributedRevenue = buildAttributedRevenue(
    attributionOverview?.attributedRevenue ?? null,
    "Attribution engine",
    null,
  );

  const paidTraffic = buildPaidTraffic(
    paidOverview && paidOverview.clicks > 0 ? paidOverview.clicks : null,
    "Paid advertising",
  );

  return {
    visitors,
    leads,
    qualifiedLeads,
    signups,
    trials,
    customers,
    revenue,
    mrr,
    organicTraffic,
    socialEngagement,
    marketingSpend,
    conversionRate: buildConversionRate(visitors, customers),
    cac: buildCac(marketingSpend, customers),
    ltv: buildLtv(),
    attributedRevenue,
    paidTraffic,
    emailPerformance: buildEmailExtension(),
  };
}

function compareKpiSet(current: PeriodKpis, previous: PeriodKpis): Record<string, MetricComparison> {
  const keys = [
    "visitors",
    "leads",
    "qualifiedLeads",
    "signups",
    "trials",
    "customers",
    "conversionRate",
    "marketingSpend",
    "revenue",
    "mrr",
    "cac",
    "ltv",
    "attributedRevenue",
    "organicTraffic",
    "paidTraffic",
    "socialEngagement",
  ] as const;

  const result: Record<string, MetricComparison> = {};
  for (const key of keys) {
    const currentMetric = current[key];
    const previousMetric = previous[key];
    if (currentMetric && previousMetric) {
      result[key] = compareMetrics(currentMetric, previousMetric);
    }
  }
  return result;
}

export const executiveDashboardService = {
  async getPreferences(userId: string, organisationId: string) {
    return prisma.executiveDashboardPreference.findUnique({
      where: { userId_organisationId: { userId, organisationId } },
    });
  },

  async savePreferences(
    userId: string,
    organisationId: string,
    input: {
      projectId?: string | null;
      brandId?: string | null;
      dateRangeDays?: number;
      comparisonType?: ExecutiveComparisonType;
      comparisonFrom?: Date | null;
      comparisonTo?: Date | null;
      reportingCurrency?: string;
      filters?: ExecutiveFilters | null;
    },
  ) {
    return prisma.executiveDashboardPreference.upsert({
      where: { userId_organisationId: { userId, organisationId } },
      create: {
        userId,
        organisationId,
        projectId: input.projectId,
        brandId: input.brandId,
        dateRangeDays: input.dateRangeDays ?? 28,
        comparisonType: input.comparisonType ?? "PREVIOUS_PERIOD",
        comparisonFrom: input.comparisonFrom,
        comparisonTo: input.comparisonTo,
        reportingCurrency: input.reportingCurrency ?? DEFAULT_REPORTING_CURRENCY,
        filters: (input.filters ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      update: {
        projectId: input.projectId,
        brandId: input.brandId,
        dateRangeDays: input.dateRangeDays,
        comparisonType: input.comparisonType,
        comparisonFrom: input.comparisonFrom,
        comparisonTo: input.comparisonTo,
        reportingCurrency: input.reportingCurrency,
        filters: (input.filters ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  },

  async getOverview(
    brandId: string,
    organisationId: string,
    from: Date,
    to: Date,
    comparisonType: ExecutiveComparisonType,
    context: TenantContext,
    options?: {
      reportingCurrency?: string;
      comparisonFrom?: Date | null;
      comparisonTo?: Date | null;
      filters?: ExecutiveFilters;
    },
  ): Promise<ExecutiveOverviewPayload> {
    await brandService.getById(brandId, organisationId, context);
    const reportingCurrency = options?.reportingCurrency ?? DEFAULT_REPORTING_CURRENCY;
    const ranges = computeDateRanges(from, to, comparisonType, {
      from: options?.comparisonFrom,
      to: options?.comparisonTo,
    });

    const cacheKey = buildExecutiveCacheKey([
      organisationId,
      brandId,
      "overview",
      ranges.from.toISOString(),
      ranges.to.toISOString(),
      ranges.comparisonFrom.toISOString(),
    ]);
    const cached = getExecutiveCache<ExecutiveOverviewPayload>(cacheKey);
    if (cached) return cached;

    const [current, previous] = await Promise.all([
      loadPeriodKpis(brandId, organisationId, ranges.from, ranges.to, context, reportingCurrency),
      loadPeriodKpis(brandId, organisationId, ranges.comparisonFrom, ranges.comparisonTo, context, reportingCurrency),
    ]);

    const payload: ExecutiveOverviewPayload = {
      kpis: compareKpiSet(current, previous),
      period: {
        from: ranges.from.toISOString(),
        to: ranges.to.toISOString(),
        comparisonFrom: ranges.comparisonFrom.toISOString(),
        comparisonTo: ranges.comparisonTo.toISOString(),
        comparisonType,
      },
      reportingCurrency,
      disclaimer: EXECUTIVE_DISCLAIMER,
      formulaDefinitions: EXECUTIVE_FORMULA_DEFINITIONS,
      extensionPoints: {
        emailPerformance: EMAIL_PERFORMANCE_EXTENSION,
      },
    };

    setExecutiveCache(cacheKey, payload);
    return payload;
  },

  async getSection(
    section: ExecutiveSection,
    brandId: string,
    organisationId: string,
    from: Date,
    to: Date,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);

    switch (section) {
      case "acquisition": {
        const result = await safeSection("Acquisition", async () => {
          const [visitors, leads, paid] = await Promise.all([
            sumWarehouseMetric(brandId, organisationId, "sessions", from, to),
            prisma.marketingLead.count({
              where: { brandId, organisationId, status: { not: "DELETED" }, createdAt: { gte: from, lte: to } },
            }),
            paidAdsDashboardService.getOverview(brandId, organisationId, from, to, context),
          ]);
          return {
            visitors: visitors ?? null,
            leads: leads > 0 ? leads : null,
            paidClicks: paid.clicks > 0 ? paid.clicks : null,
            paidSpend: paid.spend > 0 ? paid.spend : null,
          };
        });
        result.confidence = {
          source: "Warehouse + leads + paid ads",
          lastUpdated: null,
          freshness: null,
          qualityWarnings: [],
          formula: EXECUTIVE_FORMULA_DEFINITIONS.visitors,
        };
        return result;
      }
      case "social": {
        const result = await safeSection("Social", () =>
          socialAnalyticsQueryService.overview(brandId, organisationId, { from, to }, context),
        );
        if (result.data) {
          result.confidence = {
            source: "Social analytics",
            lastUpdated: result.data.range.to,
            freshness: null,
            qualityWarnings: [],
            formula: EXECUTIVE_FORMULA_DEFINITIONS.socialEngagement,
          };
        }
        return result;
      }
      case "search": {
        const result = await safeSection("Search", () =>
          gscDashboardService.getOverview(brandId, organisationId, from, to, context),
        );
        if (result.data) {
          result.confidence = {
            source: "Google Search Console",
            lastUpdated: result.data.freshness.lastSyncedDate,
            freshness: `${result.data.freshness.dataDelayDays} day delay`,
            qualityWarnings: [result.data.freshness.disclaimer],
            formula: EXECUTIVE_FORMULA_DEFINITIONS.organicTraffic,
          };
        }
        return result;
      }
      case "advertising": {
        const result = await safeSection("Advertising", () =>
          paidAdsDashboardService.getOverview(brandId, organisationId, from, to, context),
        );
        if (result.data) {
          result.confidence = {
            source: "Paid advertising providers",
            lastUpdated: null,
            freshness: null,
            qualityWarnings: result.data.mixedCurrencyWarning ? ["Mixed currencies detected."] : [],
            formula: EXECUTIVE_FORMULA_DEFINITIONS.paidTraffic,
          };
        }
        return result;
      }
      case "funnel": {
        const result = await safeSection("Funnel", () =>
          funnelDashboardService.getOverview(brandId, organisationId, context),
        );
        if (result.data) {
          result.confidence = {
            source: "Funnel analysis runs",
            lastUpdated: result.data.recentRuns[0]?.completedAt ?? null,
            freshness: null,
            qualityWarnings: [],
            formula: "Funnel conversion from latest completed analysis run.",
          };
        }
        return result;
      }
      case "attribution": {
        const result = await safeSection("Attribution", () =>
          attributionDashboardService.getOverview(brandId, organisationId, from, to, context),
        );
        if (result.data) {
          result.confidence = {
            source: "Attribution engine",
            lastUpdated: null,
            freshness: null,
            qualityWarnings: result.data.limitations ?? [],
            attributionModel: result.data.directTrafficPolicy,
            formula: EXECUTIVE_FORMULA_DEFINITIONS.attributedRevenue,
          };
        }
        return result;
      }
      case "leads": {
        const result = await safeSection("Leads", async () => {
          const base = { brandId, organisationId, status: { not: "DELETED" as const }, createdAt: { gte: from, lte: to } };
          const [total, qualified, newLeads] = await Promise.all([
            prisma.marketingLead.count({ where: base }),
            prisma.marketingLead.count({ where: { ...base, status: { in: QUALIFIED_LEAD_STATUSES } } }),
            prisma.marketingLead.count({ where: { ...base, status: "NEW" } }),
          ]);
          return {
            total: total > 0 ? total : null,
            qualified: qualified > 0 ? qualified : null,
            newLeads: newLeads > 0 ? newLeads : null,
          };
        });
        result.confidence = {
          source: "Marketing leads",
          lastUpdated: null,
          freshness: null,
          qualityWarnings: [],
          formula: EXECUTIVE_FORMULA_DEFINITIONS.leads,
        };
        return result;
      }
      case "revenue": {
        const result = await safeSection("Revenue", () =>
          revenueDashboardService.getOverview(brandId, organisationId, from, to, context),
        );
        if (result.data) {
          result.confidence = {
            source: "Revenue sources",
            lastUpdated: result.data.dataFreshness,
            freshness: result.data.dataFreshness ? "Synced" : "Never synced",
            qualityWarnings: [],
            currency: result.data.reportingCurrency,
            formula: EXECUTIVE_FORMULA_DEFINITIONS.revenue,
          };
        }
        return result;
      }
      case "data-health": {
        const result = await safeSection("Data health", () => this.getDataHealth(brandId, organisationId, context));
        return result;
      }
      default:
        return { data: null, error: "Unknown section", confidence: null };
    }
  },

  async getObjectives(brandId: string, organisationId: string, from: Date, to: Date, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const objectives = await prisma.marketingObjective.findMany({
      where: { brandId, organisationId },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    });

    const kpis = await loadPeriodKpis(brandId, organisationId, from, to, context, DEFAULT_REPORTING_CURRENCY);

    return objectives.map((objective) => {
      const actual = resolveObjectiveActual(objective.objectiveType, kpis);
      const target = Number(objective.targetValue);
      const progress = calculateObjectiveProgress(target, actual);
      return {
        id: objective.id,
        objectiveType: objective.objectiveType,
        description: objective.description,
        priority: objective.priority,
        target,
        targetPeriod: objective.targetPeriod,
        status: objective.status,
        actual,
        progressPercent: progress.progressPercent,
        remaining: progress.remaining,
        progressStatus: progress.status,
        deadline: objective.targetPeriod,
      };
    });
  },

  async getDataHealth(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const [warehouse, revenueSources, connectors] = await Promise.all([
      marketingWarehouseHealthService.listHealth(brandId, organisationId, context),
      Promise.resolve(listAvailableRevenueAdapters()),
      prisma.connectorAccount.findMany({
        where: { organisationId, brandId },
        select: {
          connectorType: true,
          status: true,
          lastSuccessfulSyncAt: true,
          lastErrorMessage: true,
        },
      }),
    ]);

    return {
      warehouse,
      revenueSources,
      connectors,
      summary: {
        healthy: warehouse.summary.healthy,
        degraded: warehouse.summary.degraded,
        unhealthy: warehouse.summary.unhealthy,
        unknown: warehouse.summary.unknown,
      },
    };
  },

  async getWarnings(brandId: string, organisationId: string, from: Date, to: Date, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const warnings: Array<{ level: string; code: string; message: string }> = [];

    const [health, revenueWarnings, attributionWarnings, funnelWarnings] = await Promise.all([
      this.getDataHealth(brandId, organisationId, context).catch(() => null),
      revenueDashboardService.getWarnings(brandId, organisationId, context).catch(() => null),
      attributionDashboardService.getWarnings(brandId, organisationId, from, to, context).catch(() => null),
      funnelDashboardService.getWarnings(brandId, organisationId, context).catch(() => null),
    ]);

    if (health) {
      if (health.summary.unhealthy > 0) {
        warnings.push({
          level: "critical",
          code: "STALE_SOURCE",
          message: `${health.summary.unhealthy} data source(s) are unhealthy.`,
        });
      }
      if (health.summary.degraded > 0) {
        warnings.push({
          level: "warning",
          code: "STALE_SOURCE",
          message: `${health.summary.degraded} data source(s) have stale data.`,
        });
      }
      const failedConnectors = health.connectors.filter((c) => c.status === "ERROR");
      for (const connector of failedConnectors) {
        warnings.push({
          level: "critical",
          code: "FAILED_CONNECTOR",
          message: `${connector.connectorType} connector failed: ${connector.lastErrorMessage ?? "unknown error"}`,
        });
      }
      const stripeAvailable = health.revenueSources.find((s) => s.sourceType === "STRIPE")?.available;
      if (!stripeAvailable) {
        warnings.push({
          level: "info",
          code: "MISSING_REVENUE_SOURCE",
          message: "Stripe revenue source is not configured.",
        });
      }
    }

    for (const source of [revenueWarnings, attributionWarnings, funnelWarnings]) {
      if (!source?.warnings) continue;
      for (const warning of source.warnings) {
        warnings.push({
          level: warning.level,
          code: "DATA_QUALITY",
          message: warning.message,
        });
      }
    }

    const unattributedJourneys = await prisma.attributionJourney.count({
      where: { brandId, organisationId, status: "UNATTRIBUTED", journeyEnd: { gte: from, lte: to } },
    });
    if (unattributedJourneys > 0) {
      warnings.push({
        level: "warning",
        code: "ATTRIBUTION_GAP",
        message: `${unattributedJourneys} conversion journeys lack attribution.`,
      });
    }

    return { warnings };
  },

  async exportCsv(
    brandId: string,
    organisationId: string,
    from: Date,
    to: Date,
    comparisonType: ExecutiveComparisonType,
    context: TenantContext,
  ) {
    const overview = await this.getOverview(brandId, organisationId, from, to, comparisonType, context);
    const objectives = await this.getObjectives(brandId, organisationId, from, to, context);
    const generatedAt = new Date().toISOString();

    const kpiRows = Object.entries(overview.kpis as Record<string, MetricComparison>).map(([key, metric]) => [
      key,
      metric.available ? String(metric.value ?? "") : "Unavailable",
      metric.previous.available ? String(metric.previous.value ?? "") : "Unavailable",
      metric.changeAbsolute != null ? String(metric.changeAbsolute) : "",
      metric.changePercent != null ? String(metric.changePercent) : "",
      metric.formula ?? "",
      metric.source ?? "",
    ]);

    const objectiveRows = objectives.map((o) => [
      o.objectiveType,
      o.description,
      String(o.target),
      o.actual.available ? String(o.actual.value ?? "") : "Unavailable",
      o.progressPercent != null ? String(o.progressPercent) : "",
      o.status,
      o.targetPeriod,
    ]);

    return {
      generatedAt,
      period: overview.period,
      disclaimer: overview.disclaimer,
      kpiRows,
      objectiveRows,
      appendix: EXECUTIVE_FORMULA_DEFINITIONS,
    };
  },
};
