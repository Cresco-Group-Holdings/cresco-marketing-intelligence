import type { ConnectorType, SocialProvider } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { buildTenantContextForUser } from "@/lib/tenancy/guards";
import type { PublishingQueueItem } from "@/components/marketing/publishing-queue";
import type { PaidChartMetric, PaidChartPoint } from "@/components/marketing/paid-performance-chart";
import type { ChannelConnectionState } from "@/components/marketing/channel-card";
import type { MarketingMetric } from "@/components/marketing/marketing-metric-card";
import { CONNECTOR_TO_PROVIDER } from "@/lib/paid-ads/constants";
import {
  resolveMarketingDateRange,
  type ResolvedMarketingDateRange,
} from "@/lib/marketing/date-range";
import { evaluateMarketingSignals } from "@/lib/marketing-intelligence/engine";
import { calculateMarketingHealth } from "@/lib/marketing-intelligence/scoring/health-score";
import {
  formatFreshnessLabel,
  formatMetricValue,
  percentChange,
  resolveDataFreshness,
  unavailableValue,
} from "@/lib/marketing-intelligence/format";
import type {
  MarketingIntelligenceContext,
  MarketingSignal,
  OrganicChannelPerformance,
  PaidProviderMetrics,
} from "@/lib/marketing-intelligence/types";
import { paidAdsConnectionService } from "@/server/services/paid-ads-connection-service";
import { paidAdsDashboardService } from "@/server/services/paid-ads-dashboard-service";
import { socialConnectionService } from "@/server/services/social-connection-service";
import { socialAnalyticsQueryService } from "@/server/services/social-analytics-query-service";
import { calendarService } from "@/server/services/calendar-service";
import { publicationService } from "@/server/services/publication-service";
import { workspaceService } from "@/server/services/workspace-service";
import {
  buildPaidMetricSeries,
  latestOrganicSyncAt,
  latestPaidSyncAt,
  sumPaidRevenue,
} from "@/server/services/marketing-command-centre-metrics";

const PAID_CONNECTOR_HREFS: Partial<Record<ConnectorType, string>> = {
  GOOGLE_ADS: "/connectors/google-ads",
  META: "/connectors/meta-ads",
  TIKTOK: "/connectors/tiktok-ads",
  LINKEDIN: "/connectors/linkedin-ads",
};

const PAID_CONNECTORS: Array<{ key: ConnectorType; label: string; href: string }> = [
  { key: "GOOGLE_ADS", label: "Google Ads", href: "/advertising/google" },
  { key: "META", label: "Meta Ads", href: "/advertising/meta" },
  { key: "TIKTOK", label: "TikTok Ads", href: "/advertising/tiktok" },
  { key: "LINKEDIN", label: "LinkedIn Ads", href: "/advertising/linkedin" },
];

const ORGANIC_CHANNELS: Array<{
  provider: SocialProvider;
  title: string;
  ctaLabel: string;
  ctaHref: string;
  connectLabel: string;
}> = [
  {
    provider: "INSTAGRAM",
    title: "Instagram Reels",
    ctaLabel: "Upload Reel",
    ctaHref: "/publishing",
    connectLabel: "Connect Instagram",
  },
  {
    provider: "TIKTOK",
    title: "TikTok Organic",
    ctaLabel: "Upload Video",
    ctaHref: "/publishing",
    connectLabel: "Connect TikTok",
  },
  {
    provider: "YOUTUBE",
    title: "YouTube Shorts",
    ctaLabel: "Upload Short",
    ctaHref: "/publishing",
    connectLabel: "Connect YouTube",
  },
  {
    provider: "LINKEDIN",
    title: "LinkedIn",
    ctaLabel: "Create Post",
    ctaHref: "/publishing",
    connectLabel: "Connect LinkedIn",
  },
  {
    provider: "FACEBOOK",
    title: "Facebook",
    ctaLabel: "Create Post",
    ctaHref: "/publishing",
    connectLabel: "Connect Facebook",
  },
];

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

function toConnectionState(connected: boolean, hasError?: boolean): ChannelConnectionState {
  if (hasError) {
    return "error";
  }
  return connected ? "connected" : "disconnected";
}

function publicationStatusLabel(status: string): PublishingQueueItem["status"] {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "APPROVED":
    case "READY":
      return "Ready";
    case "SCHEDULED":
      return "Scheduled";
    case "PUBLISHING":
      return "Publishing";
    case "PUBLISHED":
      return "Published";
    case "FAILED":
      return "Failed";
    default:
      return "Draft";
  }
}


function buildEmptyResponse(
  workspace: Awaited<ReturnType<typeof workspaceService.getResolvedWorkspace>>,
  range: ResolvedMarketingDateRange,
) {
  return {
    workspace,
    hasBrandContext: false,
    dateRange: {
      preset: range.preset,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      label: range.label,
      comparisonLabel: range.comparisonLabel,
    },
    executiveKpis: [] as MarketingMetric[],
    paidSummary: null,
    organicSummary: null,
    paidChannels: PAID_CONNECTORS.map((channel) => ({
      ...channel,
      connectHref: PAID_CONNECTOR_HREFS[channel.key] ?? "/connectors",
      connectionState: "disconnected" as ChannelConnectionState,
      metrics: [],
      statusLabel: undefined,
      emptyMessage: "No paid advertising accounts connected yet.",
      ctaLabel: "View Performance",
    })),
    organicChannels: ORGANIC_CHANNELS.map((channel) => ({
      ...channel,
      connectHref: "/social/connections",
      connectionState: "disconnected" as ChannelConnectionState,
      metrics: [],
      emptyMessage: "Connect your social channels to start publishing content.",
    })),
    paidChart: {
      spend: [],
      revenue: [],
      conversions: [],
      roas: [],
      cpa: [],
    } satisfies Record<PaidChartMetric, PaidChartPoint[]>,
    publishingQueue: [],
    calendarPreview: [],
    insights: [] as MarketingSignal[],
    health: null,
    coverage: {
      paid: "0 of 4 paid channels connected",
      organic: "0 organic channels connected",
    },
    freshness: {
      paid: "Connection required",
      organic: "Connection required",
    },
    currency: "GBP",
    hasPaidConnections: false,
    hasOrganicConnections: false,
  };
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

async function safeSocialOverview(
  brandId: string,
  organisationId: string,
  from: Date,
  to: Date,
  tenant: Awaited<ReturnType<typeof buildTenantContextForUser>>,
) {
  try {
    return await socialAnalyticsQueryService.overview(brandId, organisationId, { from, to }, tenant);
  } catch {
    return null;
  }
}

function mapOrganicChannels(
  publications: Awaited<ReturnType<typeof publicationService.list>>,
  connectedOrganicProviders: Set<SocialProvider>,
  socialOverview: Awaited<ReturnType<typeof safeSocialOverview>>,
): Array<
  (typeof ORGANIC_CHANNELS)[number] & {
    connectHref: string;
    connectionState: ChannelConnectionState;
    metrics: Array<{ label: string; value: string }>;
    emptyMessage: string;
  }
> {
  return ORGANIC_CHANNELS.map((channel) => {
    const connected = connectedOrganicProviders.has(channel.provider);
    const providerMetrics = socialOverview?.byProvider?.[channel.provider];
    const scheduledCount = publications.filter(
      (item) => item.status === "SCHEDULED" && item.providerKey.includes(channel.provider),
    ).length;
    const engagement =
      providerMetrics != null
        ? (providerMetrics.likes ?? 0) +
          (providerMetrics.comments ?? 0) +
          (providerMetrics.shares ?? 0) +
          (providerMetrics.saves ?? 0)
        : null;

    return {
      ...channel,
      connectHref: "/social/connections",
      connectionState: toConnectionState(connected),
      metrics: connected
        ? [
            {
              label: "Reach",
              value: formatMetricValue(providerMetrics?.reach ?? null, formatNumber),
            },
            {
              label: "Engagement",
              value: formatMetricValue(engagement, formatNumber),
            },
            { label: "Scheduled", value: String(scheduledCount) },
          ]
        : [],
      emptyMessage: `Connect ${channel.title} to start publishing content.`,
    };
  });
}

export const marketingCommandCentreService = {
  async getDashboard(
    userProfileId: string,
    rangeInput?: Partial<ResolvedMarketingDateRange>,
  ) {
    const range = resolveMarketingDateRange(rangeInput ?? { preset: "30d" });
    const workspace = await workspaceService.getResolvedWorkspace(userProfileId);
    const organisationId = workspace.preference.currentOrganisationId;
    const brandId = workspace.preference.currentBrandId;

    if (!organisationId || !brandId) {
      return buildEmptyResponse(workspace, range);
    }

    const tenant = await buildTenantContextForUser(userProfileId, {
      organisationId,
      projectId: workspace.preference.currentProjectId ?? undefined,
      brandId,
    });

    const [
      paidOverview,
      previousPaidOverview,
      previousRevenue,
      currentRevenue,
      paidConnections,
      socialCatalogue,
      publications,
      upcomingCalendar,
      paidChart,
      socialOverview,
      previousSocialOverview,
      paidSyncAt,
      organicSyncAt,
    ] = await Promise.all([
      safePaidOverview(brandId, organisationId, range.from, range.to, tenant),
      safePaidOverview(brandId, organisationId, range.comparisonFrom, range.comparisonTo, tenant),
      sumPaidRevenue(brandId, organisationId, range.comparisonFrom, range.comparisonTo),
      sumPaidRevenue(brandId, organisationId, range.from, range.to),
      Promise.all(
        PAID_CONNECTORS.map(async (connector) => ({
          connector: connector.key,
          status: await paidAdsConnectionService
            .getConnectionStatus(brandId, organisationId, connector.key, tenant)
            .catch(() => ({ connected: false, accountSelected: false, account: null })),
        })),
      ),
      socialConnectionService.getCatalogue(brandId, organisationId, tenant).catch(() => []),
      publicationService.list(brandId, organisationId, tenant).catch(() => []),
      calendarService.listUpcoming(organisationId, { brandId, limit: 8 }, tenant).catch(() => []),
      buildPaidMetricSeries({
        brandId,
        organisationId,
        from: range.from,
        to: range.to,
      }).catch(() => ({
        spend: [],
        revenue: [],
        conversions: [],
        roas: [],
        cpa: [],
      })),
      safeSocialOverview(brandId, organisationId, range.from, range.to, tenant),
      safeSocialOverview(brandId, organisationId, range.comparisonFrom, range.comparisonTo, tenant),
      latestPaidSyncAt(brandId, organisationId),
      latestOrganicSyncAt(brandId, organisationId),
    ]);

    const connectedPaidCount = paidConnections.filter((item) => item.status.connected).length;
    const connectedOrganicProviders = new Set(
      socialCatalogue
        .filter((item) => item.connection?.status === "CONNECTED")
        .map((item) => item.provider),
    );
    const hasPaidConnections = connectedPaidCount > 0;
    const hasOrganicConnections = connectedOrganicProviders.size > 0;
    const hasPaidData = hasPaidConnections && paidOverview.spend > 0;
    const hasOrganicData =
      hasOrganicConnections &&
      ((socialOverview?.totals?.reach ?? 0) > 0 ||
        (socialOverview?.totals?.likes ?? 0) > 0 ||
        publications.some((item) => item.status === "PUBLISHED"));

    const spendChange = percentChange(paidOverview.spend, previousPaidOverview.spend);
    const conversionsChange = percentChange(paidOverview.conversions, previousPaidOverview.conversions);
    const cpa =
      paidOverview.conversions > 0 ? paidOverview.spend / paidOverview.conversions : null;
    const previousCpa =
      previousPaidOverview.conversions > 0
        ? previousPaidOverview.spend / previousPaidOverview.conversions
        : null;
    const roas = paidOverview.spend > 0 ? currentRevenue / paidOverview.spend : null;
    const previousRoas =
      previousPaidOverview.spend > 0 ? previousRevenue / previousPaidOverview.spend : null;

    const activeCampaigns = await prisma.marketingCampaign.count({
      where: { brandId, organisationId, status: "ACTIVE" },
    });

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

    const organicChannelsDetailed: OrganicChannelPerformance[] = ORGANIC_CHANNELS.map((channel) => {
      const providerMetrics = socialOverview?.byProvider?.[channel.provider];
      const connected = connectedOrganicProviders.has(channel.provider);
      const engagement =
        providerMetrics != null
          ? (providerMetrics.likes ?? 0) +
            (providerMetrics.comments ?? 0) +
            (providerMetrics.shares ?? 0) +
            (providerMetrics.saves ?? 0)
          : null;

      return {
        provider: channel.provider,
        channel: channel.title,
        connected,
        reach: providerMetrics?.reach ?? null,
        views: providerMetrics?.views ?? providerMetrics?.videoViews ?? null,
        engagement,
        engagementRate:
          providerMetrics?.impressions && providerMetrics.impressions > 0 && engagement != null
            ? (engagement / providerMetrics.impressions) * 100
            : socialOverview?.derived?.engagementRate ?? null,
        followers: providerMetrics?.follows ?? providerMetrics?.subscribers ?? null,
        followerGrowth: socialOverview?.derived?.followerGrowth ?? null,
        shares: providerMetrics?.shares ?? null,
        saves: providerMetrics?.saves ?? null,
        published: publications.filter(
          (item) => item.status === "PUBLISHED" && item.providerKey.includes(channel.provider),
        ).length,
        scheduled: publications.filter(
          (item) => item.status === "SCHEDULED" && item.providerKey.includes(channel.provider),
        ).length,
        dataFreshness: organicSyncAt,
        unavailableMetrics: connected && !providerMetrics ? ["reach", "engagement"] : [],
      };
    });

    const publishedInRange = publications.filter((item) => item.status === "PUBLISHED").length;
    const scheduledUpcoming = publications.filter((item) => item.status === "SCHEDULED").length;
    const paidFreshness = resolveDataFreshness(paidSyncAt);
    const organicFreshness = resolveDataFreshness(organicSyncAt);

    const intelligenceContext: MarketingIntelligenceContext = {
      rangeLabel: range.label,
      comparisonLabel: range.comparisonLabel,
      paid: {
        connectedCount: connectedPaidCount,
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
        freshness: paidFreshness,
        lastSyncedAt: paidSyncAt,
      },
      organic: {
        connectedCount: connectedOrganicProviders.size,
        totalProviders: ORGANIC_CHANNELS.length,
        reach: socialOverview?.totals?.reach ?? null,
        previousReach: previousSocialOverview?.totals?.reach ?? null,
        engagement:
          socialOverview?.totals != null
            ? (socialOverview.totals.likes ?? 0) +
              (socialOverview.totals.comments ?? 0) +
              (socialOverview.totals.shares ?? 0) +
              (socialOverview.totals.saves ?? 0)
            : null,
        previousEngagement:
          previousSocialOverview?.totals != null
            ? (previousSocialOverview.totals.likes ?? 0) +
              (previousSocialOverview.totals.comments ?? 0) +
              (previousSocialOverview.totals.shares ?? 0) +
              (previousSocialOverview.totals.saves ?? 0)
            : null,
        engagementRate: socialOverview?.derived?.engagementRate ?? null,
        published: publishedInRange,
        scheduled: scheduledUpcoming,
        channels: organicChannelsDetailed,
        freshness: organicFreshness,
        lastSyncedAt: organicSyncAt,
        partialCoverageNote:
          connectedOrganicProviders.size > 0 && !socialOverview
            ? "Organic analytics unavailable for one or more connected providers."
            : undefined,
      },
      publishing: {
        publishedInRange,
        scheduledUpcoming,
        daysWithoutScheduled: scheduledUpcoming === 0 ? 5 : 0,
        strongestOrganicFormat:
          organicChannelsDetailed
            .filter((channel) => channel.connected)
            .sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0))[0]?.channel ?? null,
      },
      connectivity: {
        paidConnected: connectedPaidCount,
        paidTotal: PAID_CONNECTORS.length,
        organicConnected: connectedOrganicProviders.size,
        organicTotal: ORGANIC_CHANNELS.length,
      },
    };

    const health = calculateMarketingHealth(intelligenceContext);
    const insights = evaluateMarketingSignals(intelligenceContext);

    const paidChannels = PAID_CONNECTORS.map((channel) => {
      const connection = paidConnections.find((item) => item.connector === channel.key);
      const connected = connection?.status.connected ?? false;
      const providerMetrics = paidByProvider.find((item) => item.provider === channel.label);

      return {
        ...channel,
        connectHref: PAID_CONNECTOR_HREFS[channel.key] ?? "/connectors",
        connectionState: toConnectionState(
          connected,
          Boolean(connection?.status.account?.lastErrorMessage),
        ),
        metrics: connected
          ? [
              {
                label: "Spend",
                value: formatMetricValue(providerMetrics?.spend ?? null, (value) =>
                  formatCurrency(value),
                ),
              },
              {
                label: "ROAS",
                value:
                  providerMetrics && providerMetrics.spend > 0
                    ? `${(providerMetrics.revenue / providerMetrics.spend).toFixed(2)}x`
                    : unavailableValue(),
              },
              {
                label: "Conversions",
                value: formatMetricValue(providerMetrics?.conversions ?? null, formatNumber),
              },
              {
                label: "CPA",
                value:
                  providerMetrics && providerMetrics.conversions > 0
                    ? formatCurrency(providerMetrics.spend / providerMetrics.conversions)
                    : unavailableValue(),
              },
            ]
          : [],
        statusLabel: connected ? connection?.status.account?.status ?? "Connected" : undefined,
        emptyMessage: "No paid advertising accounts connected yet.",
        ctaLabel: "View Performance",
      };
    });

    const organicChannels = mapOrganicChannels(
      publications,
      connectedOrganicProviders,
      socialOverview,
    );

    const publishingQueue: PublishingQueueItem[] = publications
      .filter((item) =>
        ["DRAFT", "APPROVED", "SCHEDULED", "PUBLISHING", "PUBLISHED", "FAILED"].includes(
          item.status,
        ),
      )
      .slice(0, 6)
      .map((item) => ({
        id: item.id,
        platform: item.providerKey,
        title: item.destinationType,
        scheduledAt: item.scheduledFor
          ? new Date(item.scheduledFor).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Not scheduled",
        status: publicationStatusLabel(item.status),
        thumbnailLabel: item.providerKey.slice(0, 2).toUpperCase(),
      }));

    const calendarPreview = Array.from(
      upcomingCalendar.reduce((map, event) => {
        const label = new Date(event.startsAt).toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });
        const items = map.get(label) ?? [];
        items.push({
          id: event.id,
          platform: String(event.channelType ?? event.sourceEntityType ?? "Calendar"),
          title: event.title,
        });
        map.set(label, items);
        return map;
      }, new Map<string, Array<{ id: string; platform: string; title: string }>>()),
    )
      .slice(0, 4)
      .map(([dateLabel, items]) => ({ dateLabel, items }));

    const currency = paidOverview.currencies[0] ?? "GBP";

    return {
      workspace,
      hasBrandContext: true,
      dateRange: {
        preset: range.preset,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        label: range.label,
        comparisonLabel: range.comparisonLabel,
      },
      executiveKpis: [
        {
          label: "Total Spend",
          value: hasPaidData ? formatCurrency(paidOverview.spend, currency) : unavailableValue(),
          change: spendChange,
          comparisonLabel: range.comparisonLabel,
        },
        {
          label: "Organic Reach",
          value: formatMetricValue(
            hasOrganicData ? (socialOverview?.totals?.reach ?? null) : null,
            formatNumber,
          ),
          change: percentChange(
            socialOverview?.totals?.reach ?? 0,
            previousSocialOverview?.totals?.reach ?? 0,
          ),
          comparisonLabel: range.comparisonLabel,
        },
        {
          label: "Conversions",
          value: hasPaidData ? formatNumber(paidOverview.conversions) : unavailableValue(),
          change: conversionsChange,
          comparisonLabel: range.comparisonLabel,
        },
        {
          label: "Content Output",
          value: String(publishedInRange + scheduledUpcoming),
          change: null,
          comparisonLabel: "published + scheduled",
        },
        {
          label: "Marketing Health",
          value:
            health.total > 0 || hasPaidConnections || hasOrganicConnections
              ? `${health.total} / 100`
              : unavailableValue(),
          change: null,
          comparisonLabel: "deterministic composite score",
        },
      ],
      paidSummary: {
        spend: hasPaidData ? formatCurrency(paidOverview.spend, currency) : unavailableValue(),
        roas: roas != null ? `${roas.toFixed(2)}x` : unavailableValue(),
        conversions: hasPaidData ? formatNumber(paidOverview.conversions) : unavailableValue(),
        cpa: cpa != null ? formatCurrency(cpa, currency) : unavailableValue(),
        activeCampaigns: String(activeCampaigns),
      },
      organicSummary: {
        reach: formatMetricValue(
          hasOrganicData ? (socialOverview?.totals?.reach ?? null) : null,
          formatNumber,
        ),
        engagement: formatMetricValue(intelligenceContext.organic.engagement, formatNumber),
        profileVisits: formatMetricValue(socialOverview?.totals?.profileVisits ?? null, formatNumber),
        shares: formatMetricValue(socialOverview?.totals?.shares ?? null, formatNumber),
        postsPublished: String(publishedInRange),
      },
      paidChannels,
      organicChannels,
      paidChart,
      publishingQueue,
      calendarPreview,
      insights,
      health,
      coverage: {
        paid: `${connectedPaidCount} of ${PAID_CONNECTORS.length} paid channels connected`,
        organic: `${connectedOrganicProviders.size} of ${ORGANIC_CHANNELS.length} organic channels connected`,
        note: intelligenceContext.organic.partialCoverageNote,
      },
      freshness: {
        paid: formatFreshnessLabel(paidFreshness, paidSyncAt),
        organic: formatFreshnessLabel(organicFreshness, organicSyncAt),
      },
      currency,
      hasPaidConnections,
      hasOrganicConnections,
    };
  },
};

export type MarketingCommandCentreData = Awaited<
  ReturnType<typeof marketingCommandCentreService.getDashboard>
>;
