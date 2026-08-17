import type { ConnectorType } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { CONNECTOR_TO_PROVIDER } from "@/lib/paid-ads/constants";
import { buildBudgetAllocation } from "@/lib/paid-advertising/budget";
import {
  calculateCampaignPerformanceState,
  detectCreativeFatigue,
  mapCampaignStatus,
} from "@/lib/paid-advertising/performance-state";
import type {
  PaidAdvertisingWorkspaceData,
  PaidCampaignPerformance,
  PaidChannelPerformance,
  PaidCreativePerformance,
} from "@/lib/paid-advertising/types";
import {
  resolveMarketingDateRange,
  type ResolvedMarketingDateRange,
} from "@/lib/marketing/date-range";
import { evaluateMarketingSignals } from "@/lib/marketing-intelligence/engine";
import {
  formatFreshnessLabel,
  formatMetricValue,
  percentChange,
  resolveDataFreshness,
  unavailableValue,
} from "@/lib/marketing-intelligence/format";
import type {
  MarketingIntelligenceContext,
  PaidProviderMetrics,
} from "@/lib/marketing-intelligence/types";
import { buildTenantContextForUser } from "@/lib/tenancy/guards";
import { paidAdsConnectionService } from "@/server/services/paid-ads-connection-service";
import { paidAdsDashboardService } from "@/server/services/paid-ads-dashboard-service";
import {
  buildPaidMetricSeries,
  latestPaidSyncAt,
  sumPaidRevenue,
} from "@/server/services/marketing-command-centre-metrics";
import { workspaceService } from "@/server/services/workspace-service";

const PAID_CONNECTORS: Array<{ key: ConnectorType; label: string }> = [
  { key: "GOOGLE_ADS", label: "Google Ads" },
  { key: "META", label: "Meta Ads" },
  { key: "TIKTOK", label: "TikTok Ads" },
  { key: "LINKEDIN", label: "LinkedIn Ads" },
];

const PROVIDER_LABELS: Record<string, string> = {
  GOOGLE_ADS: "Google Ads",
  META: "Meta Ads",
  TIKTOK: "TikTok Ads",
  LINKEDIN: "LinkedIn Ads",
};

function formatCurrency(value: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString("en-GB");
}

function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

async function safePaidOverview(
  brandId: string,
  organisationId: string,
  from: Date,
  to: Date,
  tenant: Awaited<ReturnType<typeof buildTenantContextForUser>>,
) {
  try {
    return await paidAdsDashboardService.getOverview(brandId, organisationId, from, to, tenant);
  } catch {
    return {
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      ctr: 0,
      roasDisclaimer: "",
      byProvider: {} as Record<string, Record<string, number>>,
      currencies: ["GBP"],
      mixedCurrencyWarning: false,
    };
  }
}

function buildEmptyWorkspace(
  range: ResolvedMarketingDateRange,
  currency = "GBP",
): PaidAdvertisingWorkspaceData {
  return {
    hasBrandContext: false,
    dateRange: {
      label: range.label,
      comparisonLabel: range.comparisonLabel,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    },
    freshness: { label: "Connection required", state: "unavailable" },
    coverage: "0 of 4 paid channels connected",
    currency,
    executiveKpis: [],
    chart: { spend: [], revenue: [], conversions: [], roas: [], cpa: [] },
    channels: [],
    budgetAllocation: [],
    campaigns: [],
    creatives: [],
    insights: [],
    totals: {
      spend: 0,
      previousSpend: 0,
      revenue: 0,
      previousRevenue: 0,
      conversions: 0,
      previousConversions: 0,
      roas: null,
      cpa: null,
      budgetUtilisation: null,
      activeCampaigns: 0,
    },
  };
}

export const paidAdvertisingWorkspaceService = {
  async getWorkspace(
    userProfileId: string,
    rangeInput?: Partial<ResolvedMarketingDateRange>,
  ): Promise<PaidAdvertisingWorkspaceData> {
    const range = resolveMarketingDateRange(rangeInput ?? { preset: "30d" });
    const workspace = await workspaceService.getResolvedWorkspace(userProfileId);
    const organisationId = workspace.preference.currentOrganisationId;
    const brandId = workspace.preference.currentBrandId;

    if (!organisationId || !brandId) {
      return buildEmptyWorkspace(range);
    }

    const tenant = await buildTenantContextForUser(userProfileId, {
      organisationId,
      projectId: workspace.preference.currentProjectId ?? undefined,
      brandId,
    });

    const [
      paidOverview,
      previousPaidOverview,
      currentRevenue,
      previousRevenue,
      paidConnections,
      paidChart,
      paidSyncAt,
      campaignsRaw,
      creativesRaw,
      activeCampaigns,
    ] = await Promise.all([
      safePaidOverview(brandId, organisationId, range.from, range.to, tenant),
      safePaidOverview(brandId, organisationId, range.comparisonFrom, range.comparisonTo, tenant),
      sumPaidRevenue(brandId, organisationId, range.from, range.to).catch(() => 0),
      sumPaidRevenue(brandId, organisationId, range.comparisonFrom, range.comparisonTo).catch(
        () => 0,
      ),
      Promise.all(
        PAID_CONNECTORS.map(async (connector) => ({
          connector: connector.key,
          label: connector.label,
          status: await paidAdsConnectionService
            .getConnectionStatus(brandId, organisationId, connector.key, tenant)
            .catch(() => ({ connected: false, accountSelected: false, account: null })),
        })),
      ),
      buildPaidMetricSeries({ brandId, organisationId, from: range.from, to: range.to }).catch(
        () => ({
          spend: [],
          revenue: [],
          conversions: [],
          roas: [],
          cpa: [],
        }),
      ),
      latestPaidSyncAt(brandId, organisationId),
      prisma.marketingCampaign
        .findMany({
          where: { brandId, organisationId, provider: { in: ["GOOGLE_ADS", "META", "LINKEDIN", "TIKTOK"] } },
          orderBy: { lastSeenAt: "desc" },
          take: 100,
        })
        .catch(() => []),
      paidAdsDashboardService.getCreatives(brandId, organisationId, tenant).catch(() => []),
      prisma.marketingCampaign
        .count({
          where: { brandId, organisationId, status: "ACTIVE" },
        })
        .catch(() => 0),
    ]);

    const connectedCount = paidConnections.filter((item) => item.status.connected).length;
    const currency = paidOverview.currencies[0] ?? "GBP";
    const freshnessState = resolveDataFreshness(paidSyncAt);
    const freshnessLabel = formatFreshnessLabel(freshnessState, paidSyncAt);

    const cpa =
      paidOverview.conversions > 0 ? paidOverview.spend / paidOverview.conversions : null;
    const previousCpa =
      previousPaidOverview.conversions > 0
        ? previousPaidOverview.spend / previousPaidOverview.conversions
        : null;
    const roas = paidOverview.spend > 0 ? currentRevenue / paidOverview.spend : null;
    const previousRoas =
      previousPaidOverview.spend > 0 ? previousRevenue / previousPaidOverview.spend : null;

    const showComparison = range.comparison !== "none";

    const executiveKpis = [
      {
        label: "Spend",
        value: formatMetricValue(
          connectedCount > 0 ? paidOverview.spend : null,
          (value) => formatCurrency(value, currency),
        ),
        change: showComparison ? percentChange(paidOverview.spend, previousPaidOverview.spend) : null,
        comparisonLabel: range.comparisonLabel,
      },
      {
        label: "Revenue",
        value: formatMetricValue(
          connectedCount > 0 && currentRevenue > 0 ? currentRevenue : connectedCount > 0 ? 0 : null,
          (value) => formatCurrency(value, currency),
        ),
        change: showComparison ? percentChange(currentRevenue, previousRevenue) : null,
        comparisonLabel: range.comparisonLabel,
      },
      {
        label: "ROAS",
        value: roas != null ? `${roas.toFixed(2)}x` : unavailableValue(),
        change:
          showComparison && roas != null && previousRoas != null
            ? percentChange(roas, previousRoas)
            : null,
        comparisonLabel: range.comparisonLabel,
      },
      {
        label: "Conversions",
        value: formatMetricValue(
          connectedCount > 0 ? paidOverview.conversions : null,
          formatNumber,
        ),
        change: showComparison
          ? percentChange(paidOverview.conversions, previousPaidOverview.conversions)
          : null,
        comparisonLabel: range.comparisonLabel,
      },
      {
        label: "CPA",
        value: cpa != null ? formatCurrency(cpa, currency) : unavailableValue(),
        change:
          showComparison && cpa != null && previousCpa != null
            ? percentChange(cpa, previousCpa)
            : null,
        comparisonLabel: range.comparisonLabel,
      },
      {
        label: "Budget utilisation",
        value: unavailableValue(),
        change: null,
        comparisonLabel: range.comparisonLabel,
      },
      {
        label: "Active campaigns",
        value: connectedCount > 0 ? String(activeCampaigns) : unavailableValue(),
        change: null,
        comparisonLabel: range.comparisonLabel,
      },
    ];

    const paidByProvider: PaidProviderMetrics[] = PAID_CONNECTORS.map((channel) => {
      const providerKey = CONNECTOR_TO_PROVIDER[channel.key];
      const metrics = providerKey ? paidOverview.byProvider[providerKey] : undefined;
      const spend = metrics?.cost ?? 0;
      const conversions = metrics?.conversions ?? 0;
      const revenue = metrics?.conversion_value ?? metrics?.revenue ?? 0;
      return {
        provider: channel.label,
        spend,
        conversions,
        revenue: Number(revenue),
        clicks: metrics?.clicks ?? 0,
        impressions: metrics?.impressions ?? 0,
      };
    });

    const channels: PaidChannelPerformance[] = PAID_CONNECTORS.map((connector) => {
      const connection = paidConnections.find((item) => item.connector === connector.key);
      const connected = connection?.status.connected ?? false;
      const providerKey = CONNECTOR_TO_PROVIDER[connector.key];
      const metrics = providerKey ? paidOverview.byProvider[providerKey] : undefined;
      const spend = metrics?.cost ?? 0;
      const conversions = metrics?.conversions ?? 0;
      const revenue = Number(metrics?.conversion_value ?? metrics?.revenue ?? 0);
      const impressions = metrics?.impressions ?? 0;
      const clicks = metrics?.clicks ?? 0;
      const channelRoas = spend > 0 ? revenue / spend : null;
      const channelCpa = conversions > 0 ? spend / conversions : null;
      const channelCtr = impressions > 0 ? clicks / impressions : null;
      const lastSync = connection?.status.account?.lastSuccessfulSyncAt
        ? new Date(connection.status.account.lastSuccessfulSyncAt)
        : null;
      const channelFreshness = resolveDataFreshness(lastSync);

      return {
        provider: connector.label,
        providerKey: providerKey ?? connector.key,
        connected,
        spend: connected ? spend : null,
        revenue: connected && revenue > 0 ? revenue : connected ? 0 : null,
        impressions: connected ? impressions : null,
        clicks: connected ? clicks : null,
        conversions: connected ? conversions : null,
        roas: connected ? channelRoas : null,
        cpa: connected ? channelCpa : null,
        ctr: connected ? channelCtr : null,
        budgetUtilisation: null,
        activeCampaigns: campaignsRaw.filter(
          (campaign) => campaign.provider === providerKey && campaign.status === "ACTIVE",
        ).length,
        spendShare:
          paidOverview.spend > 0 && connected ? spend / paidOverview.spend : null,
        freshness: connected ? channelFreshness : "unavailable",
        freshnessLabel: connected
          ? formatFreshnessLabel(channelFreshness, lastSync)
          : "Disconnected",
      };
    });

    const budgetAllocation = buildBudgetAllocation(
      channels
        .filter((channel) => channel.connected && (channel.spend ?? 0) > 0)
        .map((channel) => ({
          provider: channel.provider,
          spend: channel.spend ?? 0,
          roas: channel.roas,
          budget: null,
          periodStart: range.from,
          periodEnd: range.to,
        })),
      paidOverview.spend,
    );

    const portfolioRoas = roas;
    const portfolioCpa = cpa;

    const campaignIds = campaignsRaw.map((campaign) => campaign.id);
    const [campaignSpendAgg, campaignConvAgg, campaignRevAgg] = await Promise.all([
      campaignIds.length > 0
        ? prisma.marketingCostRecord.groupBy({
            by: ["marketingCampaignId"],
            where: {
              brandId,
              organisationId,
              marketingCampaignId: { in: campaignIds },
              periodStart: { gte: range.from, lte: range.to },
            },
            _sum: { amount: true },
          })
        : Promise.resolve([]),
      campaignIds.length > 0
        ? prisma.marketingMetricObservation.groupBy({
            by: ["marketingCampaignId"],
            where: {
              marketingCampaignId: { in: campaignIds },
              metricKey: "conversions",
              observedAt: { gte: range.from, lte: range.to },
            },
            _sum: { metricValue: true },
          })
        : Promise.resolve([]),
      campaignIds.length > 0
        ? prisma.marketingMetricObservation.groupBy({
            by: ["marketingCampaignId"],
            where: {
              marketingCampaignId: { in: campaignIds },
              metricKey: { in: ["conversion_value", "revenue"] },
              observedAt: { gte: range.from, lte: range.to },
            },
            _sum: { metricValue: true },
          })
        : Promise.resolve([]),
    ]);

    const spendByCampaign = new Map(
      campaignSpendAgg.map((row) => [row.marketingCampaignId, Number(row._sum.amount ?? 0)]),
    );
    const convByCampaign = new Map(
      campaignConvAgg.map((row) => [row.marketingCampaignId, Number(row._sum.metricValue ?? 0)]),
    );
    const revByCampaign = new Map(
      campaignRevAgg.map((row) => [row.marketingCampaignId, Number(row._sum.metricValue ?? 0)]),
    );

    const campaigns: PaidCampaignPerformance[] = campaignsRaw.map((campaign) => {
      const spend = spendByCampaign.get(campaign.id) ?? 0;
      const conversions = convByCampaign.get(campaign.id) ?? 0;
      const revenue = revByCampaign.get(campaign.id) ?? 0;
      const campaignRoas = spend > 0 ? revenue / spend : null;
      const campaignCpa = conversions > 0 ? spend / conversions : null;
      const impressions = 0;
      const clicks = 0;
      const ctr = impressions > 0 ? clicks / impressions : null;

      return {
        id: campaign.id,
        provider: providerLabel(campaign.provider),
        name: campaign.name,
        status: mapCampaignStatus(campaign.status),
        objective: campaign.campaignType ?? null,
        spend: connectedCount > 0 ? spend : null,
        budget: campaign.budgetAmount ? Number(campaign.budgetAmount) : null,
        revenue: connectedCount > 0 ? revenue : null,
        conversions: connectedCount > 0 ? conversions : null,
        roas: campaignRoas,
        cpa: campaignCpa,
        ctr,
        startDate: campaign.startDate?.toISOString() ?? null,
        endDate: campaign.endDate?.toISOString() ?? null,
        performanceState: calculateCampaignPerformanceState({
          roas: campaignRoas,
          cpa: campaignCpa,
          conversions,
          spend,
          portfolioRoas,
          portfolioCpa,
        }),
        freshness: freshnessState,
      };
    });

    const creatives: PaidCreativePerformance[] = creativesRaw.slice(0, 50).map((creative) => {
      const spend = 0;
      const conversions = 0;
      const revenue = 0;
      const impressions = 0;
      const clicks = 0;
      const ctr = impressions > 0 ? clicks / impressions : null;
      const roas = spend > 0 ? revenue / spend : null;
      const cpa = conversions > 0 ? spend / conversions : null;
      const fatigue = detectCreativeFatigue({
        ctr,
        previousCtr: null,
        frequency: null,
        cpa,
        previousCpa: null,
      });

      return {
        id: creative.id,
        name: creative.name ?? creative.providerCreativeId ?? "Creative",
        provider: providerLabel(creative.provider),
        campaignName: creative.marketingAd?.name ?? null,
        format: creative.creativeType ?? null,
        spend: connectedCount > 0 ? spend : null,
        impressions: connectedCount > 0 ? impressions : null,
        clicks: connectedCount > 0 ? clicks : null,
        ctr,
        conversions: connectedCount > 0 ? conversions : null,
        cpa,
        roas,
        frequency: null,
        performanceState: calculateCampaignPerformanceState({
          roas,
          cpa,
          conversions,
          spend,
          portfolioRoas,
          portfolioCpa,
        }),
        fatigueDetected: fatigue.detected,
        fatigueReason: fatigue.reason,
      };
    });

    const intelligenceContext: MarketingIntelligenceContext = {
      rangeLabel: range.label,
      comparisonLabel: range.comparisonLabel,
      paid: {
        connectedCount,
        totalProviders: PAID_CONNECTORS.length,
        spend: paidOverview.spend,
        previousSpend: previousPaidOverview.spend,
        conversions: paidOverview.conversions,
        previousConversions: previousPaidOverview.conversions,
        revenue: currentRevenue,
        previousRevenue,
        roas,
        previousRoas,
        cpa,
        previousCpa,
        byProvider: paidByProvider,
        freshness: freshnessState,
        lastSyncedAt: paidSyncAt,
      },
      organic: {
        connectedCount: 0,
        totalProviders: 0,
        reach: null,
        previousReach: null,
        engagement: null,
        previousEngagement: null,
        engagementRate: null,
        published: 0,
        scheduled: 0,
        channels: [],
        freshness: "unavailable",
        lastSyncedAt: null,
      },
      publishing: {
        publishedInRange: 0,
        scheduledUpcoming: 0,
        daysWithoutScheduled: 0,
        strongestOrganicFormat: null,
      },
      connectivity: {
        paidConnected: connectedCount,
        paidTotal: PAID_CONNECTORS.length,
        organicConnected: 0,
        organicTotal: 0,
      },
    };

    const insights = evaluateMarketingSignals(intelligenceContext)
      .filter((signal) => signal.category === "paid")
      .slice(0, 5);

    return {
      hasBrandContext: true,
      dateRange: {
        label: range.label,
        comparisonLabel: range.comparisonLabel,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      freshness: { label: freshnessLabel, state: freshnessState },
      coverage: `${connectedCount} of ${PAID_CONNECTORS.length} paid channels connected`,
      currency,
      executiveKpis,
      chart: paidChart,
      channels,
      budgetAllocation,
      campaigns,
      creatives,
      insights,
      totals: {
        spend: paidOverview.spend,
        previousSpend: previousPaidOverview.spend,
        revenue: currentRevenue,
        previousRevenue,
        conversions: paidOverview.conversions,
        previousConversions: previousPaidOverview.conversions,
        roas,
        cpa,
        budgetUtilisation: null,
        activeCampaigns,
      },
    };
  },
};

export type { PaidAdvertisingWorkspaceData };
