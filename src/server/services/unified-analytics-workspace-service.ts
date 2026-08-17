import type { AttributionModelType, ConnectorType } from "@prisma/client";
import {
  ATTRIBUTION_DISCLAIMER,
  ATTRIBUTION_MODEL_LABELS,
  DEFAULT_LOOKBACK_WINDOW_DAYS,
} from "@/lib/attribution/constants";
import { calculateAttributionCredits, filterTouchpointsByLookback } from "@/lib/attribution/models";
import type { AttributionTouchpointInput } from "@/lib/attribution/types";
import { mapAttributionTouchpointToInput } from "@/lib/attribution/touchpoint-mapper";
import {
  computeAttributionFromJourneys,
  mapJourneyToAttributionInput,
  resolveCreditedChannel,
} from "@/lib/unified-analytics/attribution";
import {
  calculateAssistedMetrics,
  calculateOrganicAssist,
  type JourneyForAssist,
} from "@/lib/unified-analytics/assist";
import { buildCoverageDimensions } from "@/lib/unified-analytics/coverage";
import { buildUnifiedKpis } from "@/lib/unified-analytics/kpis";
import type {
  ChannelAnalyticsRow,
  ContentAnalyticsRow,
  FunnelStage,
  JourneyFlow,
  ModelComparisonRow,
  UnifiedAnalyticsWorkspaceData,
} from "@/lib/unified-analytics/types";
import {
  resolveMarketingDateRange,
  type ResolvedMarketingDateRange,
} from "@/lib/marketing/date-range";
import { evaluateAllMarketingSignals } from "@/lib/marketing-intelligence/engine";
import { formatFreshnessLabel, resolveDataFreshness } from "@/lib/marketing-intelligence/format";
import type { MarketingIntelligenceContext } from "@/lib/marketing-intelligence/types";
import { buildTenantContextForUser } from "@/lib/tenancy/guards";
import { attributionDashboardService } from "@/server/services/attribution-dashboard-service";
import { attributionModelService } from "@/server/services/attribution-model-service";
import { latestOrganicSyncAt, latestPaidSyncAt } from "@/server/services/marketing-command-centre-metrics";
import { paidAdsConnectionService } from "@/server/services/paid-ads-connection-service";
import { paidAdsDashboardService } from "@/server/services/paid-ads-dashboard-service";
import { revenueDashboardService } from "@/server/services/revenue-dashboard-service";
import { socialAnalyticsQueryService } from "@/server/services/social-analytics-query-service";
import { socialConnectionService } from "@/server/services/social-connection-service";
import { workspaceService } from "@/server/services/workspace-service";

const PAID_CONNECTORS: ConnectorType[] = ["GOOGLE_ADS", "META", "TIKTOK", "LINKEDIN"];
const PAID_CHANNELS = ["GOOGLE_ADS", "META", "TIKTOK", "LINKEDIN"] as const;
const ORGANIC_CHANNELS = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "LINKEDIN", "FACEBOOK"] as const;

const CHANNEL_LABELS: Record<string, string> = {
  GOOGLE_ADS: "Google Ads",
  META: "Meta Ads",
  TIKTOK: "TikTok Ads",
  LINKEDIN: "LinkedIn Ads",
  INSTAGRAM: "Instagram Organic",
  YOUTUBE: "YouTube Organic",
  FACEBOOK: "Facebook Organic",
};

const MODEL_DESCRIPTIONS: Record<AttributionModelType, string> = {
  FIRST_TOUCH: "Assigns full conversion credit to the first eligible marketing interaction.",
  LAST_TOUCH: "Assigns full conversion credit to the final eligible marketing interaction before conversion.",
  LINEAR: "Distributes credit equally across all eligible touchpoints.",
  POSITION_BASED: "Assigns 40% to first touch, 40% to last touch, and 20% across middle touchpoints.",
  TIME_DECAY: "Assigns more credit to touchpoints closer to conversion using time decay.",
};

function isPaidChannel(channel: string | null | undefined): boolean {
  if (!channel) return false;
  const upper = channel.toUpperCase();
  return upper.includes("ADS") || PAID_CHANNELS.some((key) => upper.includes(key));
}

function parseAttributionModel(value: string | null): AttributionModelType {
  const models: AttributionModelType[] = [
    "FIRST_TOUCH",
    "LAST_TOUCH",
    "LINEAR",
    "POSITION_BASED",
    "TIME_DECAY",
  ];
  if (value && models.includes(value as AttributionModelType)) {
    return value as AttributionModelType;
  }
  return "LAST_TOUCH";
}

function buildEmptyWorkspace(
  range: ResolvedMarketingDateRange,
  model: AttributionModelType,
): UnifiedAnalyticsWorkspaceData {
  return {
    hasBrandContext: false,
    dateRange: {
      label: range.label,
      comparisonLabel: range.comparisonLabel,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    },
    attributionModel: model,
    attributionModelLabel: ATTRIBUTION_MODEL_LABELS[model],
    lookbackWindowDays: DEFAULT_LOOKBACK_WINDOW_DAYS,
    freshness: { label: "Connection required", state: "unavailable" },
    coverage: [],
    coverageWarnings: [],
    executiveKpis: [],
    channels: [],
    content: [],
    funnel: [],
    conversions: [],
    revenue: {
      observedRevenue: null,
      attributedRevenue: null,
      unattributedRevenue: null,
      paidAttributedRevenue: null,
      organicAssistedRevenue: null,
      attributionCoverage: null,
    },
    modelComparison: [],
    journeyFlows: [],
    organicAssist: {
      rate: null,
      paidConversionsWithPriorOrganic: 0,
      totalPaidAttributedConversions: 0,
      topAssistingChannel: null,
      description: "Insufficient data.",
    },
    unattributed: { conversions: 0, revenue: null },
    insights: [],
    disclaimer: ATTRIBUTION_DISCLAIMER,
    modelOptions: (Object.keys(ATTRIBUTION_MODEL_LABELS) as AttributionModelType[]).map((type) => ({
      type,
      label: ATTRIBUTION_MODEL_LABELS[type],
      description: MODEL_DESCRIPTIONS[type],
    })),
  };
}

function aggregateJourneyFlows(
  journeys: Array<{ touchpoints: AttributionTouchpointInput[] }>,
): JourneyFlow[] {
  const flows = new Map<string, { conversions: number; revenue: number }>();

  for (const journey of journeys) {
    const path = journey.touchpoints
      .filter((tp) => !tp.isExcluded)
      .map((tp) => tp.channel ?? "Unknown")
      .slice(0, 4);
    if (path.length < 2) continue;
    const key = path.join(" → ");
    const entry = flows.get(key) ?? { conversions: 0, revenue: 0 };
    entry.conversions += 1;
    flows.set(key, entry);
  }

  return [...flows.entries()]
    .map(([path, stats]) => ({
      path: path.split(" → "),
      conversions: stats.conversions,
      revenue: stats.revenue,
    }))
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 5);
}

export const unifiedAnalyticsWorkspaceService = {
  async getWorkspace(
    userProfileId: string,
    rangeInput?: Partial<ResolvedMarketingDateRange>,
    attributionModelParam?: string | null,
  ): Promise<UnifiedAnalyticsWorkspaceData> {
    const range = resolveMarketingDateRange(rangeInput ?? { preset: "30d" });
    const attributionModel = parseAttributionModel(attributionModelParam ?? null);
    const workspace = await workspaceService.getResolvedWorkspace(userProfileId);
    const organisationId = workspace.preference.currentOrganisationId;
    const brandId = workspace.preference.currentBrandId;

    if (!organisationId || !brandId) {
      return buildEmptyWorkspace(range, attributionModel);
    }

    const tenant = await buildTenantContextForUser(userProfileId, {
      organisationId,
      projectId: workspace.preference.currentProjectId ?? undefined,
      brandId,
    });

    const showComparison = range.comparison !== "none";

    const [
      paidOverview,
      previousPaidOverview,
      socialOverview,
      socialCatalogue,
      paidConnections,
      revenueOverview,
      journeys,
      previousJourneys,
      contentAttribution,
      paidSyncAt,
      organicSyncAt,
    ] = await Promise.all([
      paidAdsDashboardService
        .getOverview(brandId, organisationId, range.from, range.to, tenant)
        .catch(() => null),
      paidAdsDashboardService
        .getOverview(brandId, organisationId, range.comparisonFrom, range.comparisonTo, tenant)
        .catch(() => null),
      socialAnalyticsQueryService
        .overview(brandId, organisationId, { from: range.from, to: range.to }, tenant)
        .catch(() => null),
      socialConnectionService.getCatalogue(brandId, organisationId, tenant).catch(() => []),
      Promise.all(
        PAID_CONNECTORS.map(async (connector) =>
          paidAdsConnectionService
            .getConnectionStatus(brandId, organisationId, connector, tenant)
            .catch(() => ({ connected: false, accountSelected: false, account: null })),
        ),
      ),
      revenueDashboardService
        .getOverview(brandId, organisationId, range.from, range.to, tenant)
        .catch(() => null),
      attributionDashboardService
        .getJourneys(brandId, organisationId, range.from, range.to, tenant)
        .catch(() => []),
      attributionDashboardService
        .getJourneys(brandId, organisationId, range.comparisonFrom, range.comparisonTo, tenant)
        .catch(() => []),
      socialAnalyticsQueryService
        .attribution(
          brandId,
          organisationId,
          { from: range.from, to: range.to },
          "CONTENT_ITEM",
          tenant,
        )
        .then((result) => result.groups)
        .catch(() => []),
      latestPaidSyncAt(brandId, organisationId),
      latestOrganicSyncAt(brandId, organisationId),
    ]);

    await attributionModelService.ensureDefaultModels(brandId, organisationId, tenant).catch(() => undefined);

    const paidConnectedCount = paidConnections.filter((status) => status.connected).length;
    const paidConnected = paidConnectedCount > 0;
    const organicConnected = socialCatalogue.some((item) => item.connection?.status === "CONNECTED");
    const paidSpend = paidOverview?.spend ?? 0;
    const previousPaidSpend = previousPaidOverview?.spend ?? 0;
    const observedRevenue = revenueOverview?.metrics.totalRevenue ?? null;

    const currentAttribution = computeAttributionFromJourneys(
      journeys.map(mapJourneyToAttributionInput),
      attributionModel,
      DEFAULT_LOOKBACK_WINDOW_DAYS,
    );
    const previousAttribution = computeAttributionFromJourneys(
      previousJourneys.map(mapJourneyToAttributionInput),
      attributionModel,
      DEFAULT_LOOKBACK_WINDOW_DAYS,
    );

    const attributedRevenue =
      currentAttribution.attributedRevenue > 0 ? currentAttribution.attributedRevenue : null;
    const previousAttributedRevenue =
      previousAttribution.attributedRevenue > 0 ? previousAttribution.attributedRevenue : null;
    const conversions = currentAttribution.attributedConversions;
    const previousConversions = previousAttribution.attributedConversions;
    const unattributedConversions = currentAttribution.unattributedConversions;
    const channelBreakdown = currentAttribution.channelBreakdown;

    const freshnessState = resolveDataFreshness(paidSyncAt ?? organicSyncAt);
    const freshnessLabel = formatFreshnessLabel(freshnessState, paidSyncAt ?? organicSyncAt);

    const { coverage, warnings } = buildCoverageDimensions({
      paidConnected: paidSpend > 0 || paidConnected,
      paidSpendAvailable: paidSpend > 0,
      organicConnected,
      organicAnalyticsAvailable: socialOverview != null,
      conversionsTracked: conversions,
      conversionsObserved: conversions + unattributedConversions,
      revenueObserved: observedRevenue,
      revenueAttributed: attributedRevenue,
      journeysWithTouchpoints: journeys.filter((j) => j.touchpointCount > 0).length,
      totalJourneys: journeys.length,
    });

    const revenueCoveragePercent =
      coverage.find((item) => item.dimension === "Revenue Coverage")?.coveragePercent ?? null;
    const paidSpendCoveragePercent =
      coverage.find((item) => item.dimension === "Paid Spend Coverage")?.coveragePercent ?? null;

    const totalAttributed = channelBreakdown.reduce((sum, row) => sum + row.creditValue, 0);

    let organicContribution = 0;
    let paidContribution = 0;
    for (const row of channelBreakdown) {
      if (isPaidChannel(row.channel)) {
        paidContribution += row.creditValue;
      } else {
        organicContribution += row.creditValue;
      }
    }

    const channels: ChannelAnalyticsRow[] = [];

    if (paidOverview?.byProvider) {
      for (const provider of PAID_CHANNELS) {
        const metrics = paidOverview.byProvider[provider];
        const spend = metrics?.cost ?? 0;
        const providerConversions = metrics?.conversions ?? 0;
        const channelLabel = CHANNEL_LABELS[provider] ?? provider;
        const attributed = channelBreakdown.find((row) =>
          row.channel.toUpperCase().includes(provider.replace("_ADS", "")),
        );
        const attributedRevenueChannel = attributed?.creditValue ?? null;
        channels.push({
          channel: channelLabel,
          sourceType: "paid",
          spend: spend > 0 ? spend : null,
          reach: null,
          impressions: metrics?.impressions ?? null,
          clicks: metrics?.clicks ?? null,
          engagement: null,
          conversions: providerConversions > 0 ? providerConversions : null,
          attributedRevenue: attributedRevenueChannel,
          roas: spend > 0 && attributedRevenueChannel ? attributedRevenueChannel / spend : null,
          contributionPercent:
            totalAttributed > 0 && attributedRevenueChannel
              ? (attributedRevenueChannel / totalAttributed) * 100
              : null,
          assistPercent: null,
          freshness: resolveDataFreshness(paidSyncAt),
          providerReportedConversions: providerConversions > 0 ? providerConversions : null,
          crescoTrackedConversions: attributed?.conversions ?? null,
        });
      }
    }

    if (socialOverview?.byProvider) {
      for (const provider of ORGANIC_CHANNELS) {
        const metrics = socialOverview.byProvider[provider];
        if (!metrics) continue;
        const engagement =
          (metrics.likes ?? 0) +
          (metrics.comments ?? 0) +
          (metrics.shares ?? 0) +
          (metrics.saves ?? 0);
        const channelLabel = CHANNEL_LABELS[provider] ?? `${provider} Organic`;
        const attributed = channelBreakdown.find((row) =>
          row.channel.toUpperCase().includes(provider),
        );
        channels.push({
          channel: channelLabel,
          sourceType: "organic",
          spend: null,
          reach: metrics.reach ?? null,
          impressions: metrics.impressions ?? null,
          clicks: metrics.clicks ?? null,
          engagement: engagement > 0 ? engagement : null,
          conversions: null,
          attributedRevenue: attributed?.creditValue ?? null,
          roas: null,
          contributionPercent:
            totalAttributed > 0 && attributed?.creditValue
              ? (attributed.creditValue / totalAttributed) * 100
              : null,
          assistPercent: null,
          freshness: resolveDataFreshness(organicSyncAt),
          providerReportedConversions: null,
          crescoTrackedConversions: attributed?.conversions ?? null,
        });
      }
    }

    const journeyAssistInput: JourneyForAssist[] = journeys.map((journey) => {
      const touchpoints: AttributionTouchpointInput[] = journey.touchpoints.map((tp) =>
        mapAttributionTouchpointToInput(tp),
      );
      const conversionAt = new Date(journey.journeyEnd ?? journey.journeyStart);
      const credited = resolveCreditedChannel(
        touchpoints,
        conversionAt,
        attributionModel,
        DEFAULT_LOOKBACK_WINDOW_DAYS,
      );
      return {
        conversionAt,
        creditedChannel: credited.channel,
        creditedSourceType: credited.sourceType,
        touchpoints,
      };
    });

    const organicAssist = calculateOrganicAssist(journeyAssistInput);

    const assistedByContent = calculateAssistedMetrics(
      journeys.map((journey) => {
        const touchpoints: AttributionTouchpointInput[] = journey.touchpoints.map((tp) =>
          mapAttributionTouchpointToInput(tp),
        );
        const conversionAt = new Date(journey.journeyEnd ?? journey.journeyStart);
        const { included } = filterTouchpointsByLookback(
          touchpoints,
          conversionAt,
          DEFAULT_LOOKBACK_WINDOW_DAYS,
        );
        const creditResult = calculateAttributionCredits({
          modelType: attributionModel,
          touchpoints: included,
          revenueValue: journey.revenueValue,
          directTrafficPolicy: "RETAIN",
          conversionAt,
        });
        const topContentCredit = creditResult.credits
          .filter((credit) => credit.contentKey && credit.creditPercent > 0)
          .sort((a, b) => b.creditPercent - a.creditPercent)[0];

        return {
          revenueValue: journey.revenueValue,
          conversionAt,
          creditedContentKey: topContentCredit?.contentKey ?? null,
          touchpoints,
        };
      }),
    );

    const contentAssistedRevenue = [...assistedByContent.values()].reduce(
      (sum, item) => sum + item.assistedRevenue,
      0,
    );

    const content: ContentAnalyticsRow[] = contentAttribution.slice(0, 50).map((group) => {
      const assist = assistedByContent.get(group.key);
      return {
        contentId: group.key,
        title: group.label,
        format: group.label,
        organicReach: group.totals?.reach ?? null,
        organicEngagement:
          (group.totals?.likes ?? 0) +
            (group.totals?.comments ?? 0) +
            (group.totals?.shares ?? 0) +
            (group.totals?.saves ?? 0) || null,
        paidSpend: null,
        paidRoas: null,
        attributedConversions: assist?.attributedConversions ?? null,
        attributedRevenue: assist?.attributedRevenue ?? null,
        assistedConversions: assist?.assistedConversions ?? null,
        assistedRevenue: assist?.assistedRevenue ?? null,
        channels: group.providers ?? [],
      };
    });

    const impressions = paidOverview?.impressions ?? socialOverview?.totals?.impressions ?? null;
    const clicks = paidOverview?.clicks ?? socialOverview?.totals?.clicks ?? null;
    const visits = socialOverview?.totals?.profileVisits ?? null;

    const funnel: FunnelStage[] = [
      {
        stage: "Impressions",
        count: impressions,
        conversionRate: null,
        dropOffPercent: null,
      },
      {
        stage: "Engagement",
        count:
          socialOverview?.totals != null
            ? (socialOverview.totals.likes ?? 0) +
              (socialOverview.totals.comments ?? 0) +
              (socialOverview.totals.shares ?? 0)
            : null,
        conversionRate: null,
        dropOffPercent: null,
      },
      {
        stage: "Clicks",
        count: clicks,
        conversionRate:
          impressions && clicks ? (clicks / impressions) * 100 : null,
        dropOffPercent: null,
      },
      {
        stage: "Visits",
        count: visits,
        conversionRate: clicks && visits ? (visits / clicks) * 100 : null,
        dropOffPercent:
          clicks && visits && clicks > 0 ? ((clicks - visits) / clicks) * 100 : null,
      },
      {
        stage: "Conversions",
        count: conversions > 0 ? conversions : null,
        conversionRate: null,
        dropOffPercent: null,
      },
      {
        stage: "Revenue",
        count: attributedRevenue != null ? Math.round(attributedRevenue) : null,
        conversionRate: null,
        dropOffPercent: null,
      },
    ];

    const conversionRows = channelBreakdown.map((row, index) => ({
      id: `channel-${index}`,
      conversionType: "Attributed",
      count: row.conversions,
      attributedChannel: row.channel,
      attributedCampaign: null,
      attributedContent: null,
      revenue: row.creditValue,
      model: ATTRIBUTION_MODEL_LABELS[attributionModel],
      coverage: revenueCoveragePercent,
    }));

    const unattributedRevenue =
      observedRevenue != null && attributedRevenue != null
        ? Math.max(0, observedRevenue - attributedRevenue)
        : null;

    const modelComparison: ModelComparisonRow[] = [];
    const modelTypes: AttributionModelType[] = [
      "FIRST_TOUCH",
      "LAST_TOUCH",
      "LINEAR",
      "POSITION_BASED",
      "TIME_DECAY",
    ];

    for (const modelType of modelTypes) {
      const channelCredits = new Map<string, number>();
      for (const journey of journeys.slice(0, 30)) {
        const touchpoints: AttributionTouchpointInput[] = journey.touchpoints.map((tp) =>
          mapAttributionTouchpointToInput(tp),
        );
        const conversionAt = new Date(journey.journeyEnd ?? journey.journeyStart);
        const { included } = filterTouchpointsByLookback(
          touchpoints,
          conversionAt,
          DEFAULT_LOOKBACK_WINDOW_DAYS,
        );
        const result = calculateAttributionCredits({
          modelType,
          touchpoints: included,
          revenueValue: journey.revenueValue,
          directTrafficPolicy: "RETAIN",
          conversionAt,
        });
        for (const credit of result.credits) {
          const channel = credit.channel ?? "Unknown";
          channelCredits.set(channel, (channelCredits.get(channel) ?? 0) + (credit.creditValue ?? 0));
        }
      }
      const modelTotal = [...channelCredits.values()].reduce((sum, value) => sum + value, 0);
      for (const [channel, value] of channelCredits.entries()) {
        modelComparison.push({
          modelType,
          modelLabel: ATTRIBUTION_MODEL_LABELS[modelType],
          channel,
          contributionPercent: modelTotal > 0 ? (value / modelTotal) * 100 : 0,
          attributedRevenue: value,
        });
      }
    }

    const journeyFlows = aggregateJourneyFlows(
      journeys.map((journey) => ({
        touchpoints: journey.touchpoints.map((tp) => mapAttributionTouchpointToInput(tp)),
      })),
    );

    const executiveKpis = buildUnifiedKpis({
      paidSpend,
      previousPaidSpend,
      attributedRevenue,
      previousAttributedRevenue,
      observedRevenue,
      conversions,
      previousConversions,
      paidConversions: paidOverview?.conversions ?? 0,
      organicContributionRevenue: organicContribution > 0 ? organicContribution : null,
      paidContributionRevenue: paidContribution > 0 ? paidContribution : null,
      contentAssistedRevenue: contentAssistedRevenue > 0 ? contentAssistedRevenue : null,
      attributionModelLabel: ATTRIBUTION_MODEL_LABELS[attributionModel],
      revenueCoveragePercent,
      paidSpendCoveragePercent,
      showComparison,
      comparisonLabel: range.comparisonLabel,
    });

    const paidByProvider = PAID_CHANNELS.map((provider) => {
      const metrics = paidOverview?.byProvider?.[provider];
      const spend = metrics?.cost ?? 0;
      const providerConversions = metrics?.conversions ?? 0;
      const channelRow = channelBreakdown.find((row) =>
        row.channel.toUpperCase().includes(provider.replace("_ADS", "")),
      );
      return {
        provider,
        spend,
        conversions: providerConversions,
        revenue: channelRow?.creditValue ?? 0,
        clicks: metrics?.clicks ?? 0,
        impressions: metrics?.impressions ?? 0,
        trackedConversions: channelRow?.conversions ?? 0,
      };
    }).filter((row) => row.spend > 0 || row.conversions > 0);

    const previousChannelBreakdown = previousAttribution.channelBreakdown;
    const topCurrent = channelBreakdown[0];
    const topPrevious = previousChannelBreakdown[0];
    const currentTopShare =
      totalAttributed > 0 && topCurrent ? (topCurrent.creditValue / totalAttributed) * 100 : null;
    const previousTotal = previousChannelBreakdown.reduce((sum, row) => sum + row.creditValue, 0);
    const previousTopShare =
      previousTotal > 0 && topPrevious
        ? (topPrevious.creditValue / previousTotal) * 100
        : null;

    const clickVisitDropOff =
      clicks && visits && clicks > 0 ? ((clicks - visits) / clicks) * 100 : null;

    const intelligenceContext: MarketingIntelligenceContext = {
      rangeLabel: range.label,
      comparisonLabel: range.comparisonLabel,
      paid: {
        connectedCount: paidConnectedCount,
        totalProviders: PAID_CHANNELS.length,
        spend: paidSpend,
        previousSpend: previousPaidSpend,
        conversions: paidOverview?.conversions ?? 0,
        previousConversions: previousPaidOverview?.conversions ?? 0,
        revenue: attributedRevenue ?? 0,
        previousRevenue: previousAttributedRevenue ?? 0,
        roas: paidSpend > 0 && attributedRevenue ? attributedRevenue / paidSpend : null,
        previousRoas: null,
        cpa:
          conversions > 0 && paidSpend > 0 ? paidSpend / conversions : null,
        previousCpa: null,
        byProvider: paidByProvider.map((row) => ({
          provider: row.provider,
          spend: row.spend,
          conversions: row.conversions,
          revenue: row.revenue,
          clicks: row.clicks,
          impressions: row.impressions,
        })),
        freshness: resolveDataFreshness(paidSyncAt),
        lastSyncedAt: paidSyncAt,
      },
      organic: {
        connectedCount: channels.filter((c) => c.sourceType === "organic").length,
        totalProviders: ORGANIC_CHANNELS.length,
        reach: socialOverview?.totals?.reach ?? null,
        previousReach: null,
        engagement: null,
        previousEngagement: null,
        engagementRate: socialOverview?.derived?.engagementRate ?? null,
        published: 0,
        scheduled: 0,
        channels: [],
        freshness: resolveDataFreshness(organicSyncAt),
        lastSyncedAt: organicSyncAt,
      },
      publishing: {
        publishedInRange: 0,
        scheduledUpcoming: 0,
        daysWithoutScheduled: null,
        strongestOrganicFormat: null,
      },
      connectivity: {
        paidConnected: paidConnectedCount,
        paidTotal: PAID_CHANNELS.length,
        organicConnected: channels.filter((c) => c.sourceType === "organic").length,
        organicTotal: ORGANIC_CHANNELS.length,
      },
      analytics: {
        attributionModel: ATTRIBUTION_MODEL_LABELS[attributionModel],
        attributedRevenue,
        observedRevenue,
        attributionCoveragePercent:
          coverage.find((item) => item.dimension === "Attribution Coverage")?.coveragePercent ?? null,
        revenueCoveragePercent,
        organicAssistRate: organicAssist.rate,
        contentAssistedRevenue: contentAssistedRevenue > 0 ? contentAssistedRevenue : null,
        contentAttributedRevenue: content.reduce(
          (sum, row) => sum + (row.attributedRevenue ?? 0),
          0,
        ),
        channelContributionShift:
          topCurrent &&
          topPrevious &&
          currentTopShare != null &&
          previousTopShare != null &&
          topCurrent.channel === topPrevious.channel &&
          Math.abs(currentTopShare - previousTopShare) >= 8
            ? {
                channel: topCurrent.channel,
                fromPercent: previousTopShare,
                toPercent: currentTopShare,
              }
            : null,
        providerDiscrepancies: paidByProvider
          .filter(
            (row) =>
              row.conversions > 0 &&
              row.trackedConversions > 0 &&
              Math.abs(row.conversions - row.trackedConversions) / row.conversions >= 0.15,
          )
          .map((row) => ({
            provider: row.provider,
            providerConversions: row.conversions,
            trackedConversions: Math.round(row.trackedConversions),
          })),
        funnelClickVisitDropOff: clickVisitDropOff,
      },
    };

    const insights = evaluateAllMarketingSignals(intelligenceContext).slice(0, 5);

    return {
      hasBrandContext: true,
      dateRange: {
        label: range.label,
        comparisonLabel: range.comparisonLabel,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      attributionModel,
      attributionModelLabel: ATTRIBUTION_MODEL_LABELS[attributionModel],
      lookbackWindowDays: DEFAULT_LOOKBACK_WINDOW_DAYS,
      freshness: { label: freshnessLabel, state: freshnessState },
      coverage,
      coverageWarnings: warnings,
      executiveKpis,
      channels,
      content,
      funnel,
      conversions: conversionRows,
      revenue: {
        observedRevenue,
        attributedRevenue,
        unattributedRevenue,
        paidAttributedRevenue: paidContribution > 0 ? paidContribution : null,
        organicAssistedRevenue: contentAssistedRevenue > 0 ? contentAssistedRevenue : null,
        attributionCoverage: revenueCoveragePercent,
      },
      modelComparison,
      journeyFlows,
      organicAssist,
      unattributed: {
        conversions: unattributedConversions,
        revenue: unattributedRevenue,
      },
      insights,
      disclaimer: ATTRIBUTION_DISCLAIMER,
      modelOptions: (Object.keys(ATTRIBUTION_MODEL_LABELS) as AttributionModelType[]).map((type) => ({
        type,
        label: ATTRIBUTION_MODEL_LABELS[type],
        description: MODEL_DESCRIPTIONS[type],
      })),
    };
  },

  getModelOptions(): Array<{ type: AttributionModelType; label: string; description: string }> {
    return (Object.keys(ATTRIBUTION_MODEL_LABELS) as AttributionModelType[]).map((type) => ({
      type,
      label: ATTRIBUTION_MODEL_LABELS[type],
      description: MODEL_DESCRIPTIONS[type],
    }));
  },
};

export type { UnifiedAnalyticsWorkspaceData };
