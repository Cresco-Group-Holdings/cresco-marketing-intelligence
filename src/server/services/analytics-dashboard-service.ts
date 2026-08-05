import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { BASE_METRIC_KEYS } from "@/lib/analytics-core/constants";
import { normaliseDateRange } from "@/lib/analytics-core/date-boundaries";
import { resolveDataCoverageState } from "@/lib/analytics-core/data-state";
import { decimalToNumber } from "@/lib/analytics-core/decimal";
import { computeAnalyticsFreshness } from "@/lib/analytics-core/freshness";
import { computeAllDerivedMetrics } from "@/lib/analytics-core/metric-engine";
import { assertOrganisationScope, type TenantContext } from "@/lib/tenancy/context";
import type { AnalyticsDashboardFiltersInput } from "@/lib/validation/analytics-core";
import { analyticsCoreService } from "@/server/services/analytics-core-service";

type MetricMap = Record<string, number>;

function buildMetricMap(totals: Record<string, number>): MetricMap {
  return { ...totals };
}

function derivedValues(totals: Record<string, number>) {
  const derived = computeAllDerivedMetrics(totals);
  const values: Record<string, number | null> = {};
  const partialMetrics: string[] = [];
  for (const [key, result] of Object.entries(derived)) {
    values[key] = decimalToNumber(result.value);
    if (result.missingInputs.length > 0 && result.value === null) {
      partialMetrics.push(key);
    }
  }
  return { values, partialMetrics };
}

async function loadTotals(
  organisationId: string,
  filters: AnalyticsDashboardFiltersInput,
  context: TenantContext,
) {
  const range = normaliseDateRange({ from: filters.from, to: filters.to });
  const { totals } = await analyticsCoreService.aggregateMetrics(
    organisationId,
    { ...filters, from: range.from.toISOString(), to: range.to.toISOString() },
    context,
  );
  return totals;
}

function freshnessContract(
  lastDataAt: Date | null,
  coverage: ReturnType<typeof resolveDataCoverageState>,
) {
  const freshness = computeAnalyticsFreshness({ lastDataAt });
  return {
    state: freshness.state,
    lagMinutes: freshness.lagMinutes,
    lastDataAt: lastDataAt?.toISOString() ?? null,
    coverageState: coverage.state,
    warnings: coverage.warnings,
  };
}

export const analyticsDashboardService = {
  async getExecutiveOverview(
    organisationId: string,
    filters: AnalyticsDashboardFiltersInput,
    context: TenantContext,
  ) {
    assertOrganisationScope(organisationId, context);
    const totals = await loadTotals(organisationId, filters, context);
    const coverage = resolveDataCoverageState({
      hasFacts: Object.keys(totals).length > 0,
      presentMetricKeys: Object.keys(totals),
      expectedMetricKeys: [...BASE_METRIC_KEYS],
    });
    const { values: derived, partialMetrics } = derivedValues(totals);
    const lastDataAt = await analyticsCoreService.getLastFactAt(organisationId, {
      brandId: filters.brandId,
      campaignId: filters.campaignId,
    });

    return {
      contract: "executive_overview",
      period: { from: filters.from, to: filters.to },
      baseMetrics: totals,
      derivedMetrics: derived,
      freshness: freshnessContract(lastDataAt, coverage),
      partialMetrics,
      provenance: { source: "analytics_fact", providerConnected: false },
    };
  },

  async getCampaignPerformance(
    organisationId: string,
    filters: AnalyticsDashboardFiltersInput,
    context: TenantContext,
  ) {
    assertOrganisationScope(organisationId, context);
    const range = normaliseDateRange({ from: filters.from, to: filters.to });
    const campaigns = await prisma.campaign.findMany({
      where: {
        organisationId,
        archivedAt: null,
        ...(filters.brandId ? { brandId: filters.brandId } : {}),
        ...(filters.campaignId ? { id: filters.campaignId } : {}),
      },
      select: { id: true, name: true, budgetAmount: true, budgetCurrency: true },
      take: 50,
    });

    const rows = await Promise.all(
      campaigns.map(async (campaign) => {
          const totals = await loadTotals(
            organisationId,
            {
              ...filters,
              campaignId: campaign.id,
              from: range.from.toISOString(),
              to: range.to.toISOString(),
            },
            context,
          );
        const { values: derived } = derivedValues(totals);
        return {
          campaignId: campaign.id,
          campaignName: campaign.name,
          baseMetrics: totals,
          derivedMetrics: derived,
        };
      }),
    );

    const hasData = rows.some((row) => Object.keys(row.baseMetrics).length > 0);
    const coverage = resolveDataCoverageState({
      hasFacts: hasData,
      presentMetricKeys: rows.flatMap((row) => Object.keys(row.baseMetrics)),
    });

    return {
      contract: "campaign_performance",
      period: { from: filters.from, to: filters.to },
      campaigns: rows,
      freshness: freshnessContract(
        await analyticsCoreService.getLastFactAt(organisationId, { campaignId: filters.campaignId }),
        coverage,
      ),
    };
  },

  async getChannelPerformance(
    organisationId: string,
    filters: AnalyticsDashboardFiltersInput,
    context: TenantContext,
  ) {
    assertOrganisationScope(organisationId, context);
    const range = normaliseDateRange({ from: filters.from, to: filters.to });
    const channels = await prisma.analyticsFact.groupBy({
      by: ["channel"],
      where: {
        organisationId,
        channel: { not: null },
        occurredAt: { gte: range.from, lte: range.to },
        ...(filters.brandId ? { brandId: filters.brandId } : {}),
        ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
      },
      _count: { _all: true },
    });

    const channelRows = await Promise.all(
      channels
        .filter((entry) => entry.channel)
        .map(async (entry) => {
          const totals = await loadTotals(
            organisationId,
            {
              ...filters,
              channel: entry.channel!,
              from: range.from.toISOString(),
              to: range.to.toISOString(),
            },
            context,
          );
          const { values: derived } = derivedValues(totals);
          return {
            channel: entry.channel,
            factCount: entry._count._all,
            baseMetrics: totals,
            derivedMetrics: derived,
          };
        }),
    );

    const coverage = resolveDataCoverageState({
      hasFacts: channelRows.length > 0,
      presentMetricKeys: channelRows.flatMap((row) => Object.keys(row.baseMetrics)),
    });

    return {
      contract: "channel_performance",
      period: { from: filters.from, to: filters.to },
      channels: channelRows,
      freshness: freshnessContract(await analyticsCoreService.getLastFactAt(organisationId), coverage),
    };
  },

  async getKpiProgress(
    organisationId: string,
    filters: AnalyticsDashboardFiltersInput,
    context: TenantContext,
  ) {
    assertOrganisationScope(organisationId, context);
    const kpis = await prisma.campaignKpi.findMany({
      where: {
        organisationId,
        ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
      },
      include: { campaign: { select: { id: true, name: true } } },
      take: 100,
    });

    const totals = await loadTotals(organisationId, filters, context);
    const metricMap = buildMetricMap(totals);

    const items = kpis.map((kpi) => {
      const metricKey = kpi.metricKey ?? kpi.name.toLowerCase().replace(/\s+/g, "_");
      const actual = metricMap[metricKey] ?? null;
      const target = kpi.targetValue ? Number(kpi.targetValue.toString()) : null;
      const progressPercent =
        actual !== null && target && target > 0 ? Number(((actual / target) * 100).toFixed(2)) : null;
      return {
        kpiId: kpi.id,
        campaignId: kpi.campaignId,
        campaignName: kpi.campaign.name,
        metricKey,
        target,
        actual,
        progressPercent,
        currency: kpi.unit === "currency" ? kpi.unit : null,
      };
    });

    return {
      contract: "kpi_progress",
      period: { from: filters.from, to: filters.to },
      items,
      hasKpis: items.length > 0,
    };
  },

  async getBudgetPacing(
    organisationId: string,
    filters: AnalyticsDashboardFiltersInput,
    context: TenantContext,
  ) {
    assertOrganisationScope(organisationId, context);
    const range = normaliseDateRange({ from: filters.from, to: filters.to });
    const campaigns = await prisma.campaign.findMany({
      where: {
        organisationId,
        archivedAt: null,
        budgetAmount: { not: null },
        ...(filters.campaignId ? { id: filters.campaignId } : {}),
        ...(filters.brandId ? { brandId: filters.brandId } : {}),
      },
      select: {
        id: true,
        name: true,
        budgetAmount: true,
        budgetCurrency: true,
        startAt: true,
        endAt: true,
      },
      take: 50,
    });

    const items = await Promise.all(
      campaigns.map(async (campaign) => {
        const spendGroups = await prisma.analyticsFact.groupBy({
          by: ["currency"],
          where: {
            organisationId,
            campaignId: campaign.id,
            metricKey: "spend",
            occurredAt: { gte: range.from, lte: range.to },
          },
          _sum: { value: true },
        });

        const spendByCurrency = spendGroups.map((group) => ({
          currency: group.currency,
          spend: group._sum.value ? Number(group._sum.value.toString()) : 0,
        }));

        const budget = campaign.budgetAmount ? Number(campaign.budgetAmount.toString()) : null;
        const primarySpend = spendByCurrency.find((entry) => entry.currency === campaign.budgetCurrency);
        const spent = primarySpend?.spend ?? spendByCurrency[0]?.spend ?? 0;
        const pacingPercent = budget && budget > 0 ? Number(((spent / budget) * 100).toFixed(2)) : null;

        return {
          campaignId: campaign.id,
          campaignName: campaign.name,
          budget,
          budgetCurrency: campaign.budgetCurrency,
          spent,
          pacingPercent,
          spendByCurrency,
          period: {
            startAt: campaign.startAt?.toISOString() ?? null,
            endAt: campaign.endAt?.toISOString() ?? null,
          },
        };
      }),
    );

    return {
      contract: "budget_pacing",
      period: { from: filters.from, to: filters.to },
      items,
    };
  },

  async getDataFreshness(
    organisationId: string,
    filters: AnalyticsDashboardFiltersInput,
    context: TenantContext,
  ) {
    assertOrganisationScope(organisationId, context);
    const sources = await prisma.analyticsDataSource.findMany({
      where: { organisationId },
      orderBy: { updatedAt: "desc" },
    });

    const lastDataAt = await analyticsCoreService.getLastFactAt(organisationId, {
      brandId: filters.brandId,
      campaignId: filters.campaignId,
    });

    const coverage = resolveDataCoverageState({
      hasFacts: Boolean(lastDataAt),
      presentMetricKeys: Object.keys(await loadTotals(organisationId, filters, context)),
    });

    return {
      contract: "data_freshness",
      freshness: freshnessContract(lastDataAt, coverage),
      sources: sources.map((source) => ({
        id: source.id,
        name: source.name,
        kind: source.kind,
        status: source.status,
        providerKey: source.providerKey,
        lastImportAt: source.lastImportAt?.toISOString() ?? null,
      })),
    };
  },

  async getAnomalies(
    organisationId: string,
    filters: AnalyticsDashboardFiltersInput,
    context: TenantContext,
  ) {
    assertOrganisationScope(organisationId, context);
    const range = normaliseDateRange({ from: filters.from, to: filters.to });
    const midpoint = new Date((range.from.getTime() + range.to.getTime()) / 2);

    const [firstHalf, secondHalf] = await Promise.all([
      prisma.analyticsFact.groupBy({
        by: ["metricKey"],
        where: {
          organisationId,
          occurredAt: { gte: range.from, lt: midpoint },
          ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
        },
        _sum: { value: true },
      }),
      prisma.analyticsFact.groupBy({
        by: ["metricKey"],
        where: {
          organisationId,
          occurredAt: { gte: midpoint, lte: range.to },
          ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
        },
        _sum: { value: true },
      }),
    ]);

    const firstMap = new Map(
      firstHalf.map((row) => [row.metricKey, Number((row._sum.value ?? new Prisma.Decimal(0)).toString())]),
    );
    const anomalies: Array<{
      metricKey: string;
      previousValue: number;
      currentValue: number;
      changePercent: number;
    }> = [];

    for (const row of secondHalf) {
      const currentValue = Number((row._sum.value ?? new Prisma.Decimal(0)).toString());
      const previousValue = firstMap.get(row.metricKey) ?? 0;
      if (previousValue === 0) continue;
      const changePercent = Number((((currentValue - previousValue) / previousValue) * 100).toFixed(2));
      if (Math.abs(changePercent) >= 50) {
        anomalies.push({ metricKey: row.metricKey, previousValue, currentValue, changePercent });
      }
    }

    return {
      contract: "anomalies",
      period: { from: filters.from, to: filters.to },
      anomalies,
      note: "Anomalies compare first vs second half of the selected period (50% threshold).",
    };
  },
};
