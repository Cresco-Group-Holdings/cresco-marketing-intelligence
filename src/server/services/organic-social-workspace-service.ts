import type { SocialProvider } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { calculateBestPostingWindows } from "@/lib/organic-social/best-time";
import {
  calculatePublishingConsistencyScore,
  detectScheduleGaps,
} from "@/lib/organic-social/consistency";
import {
  mapContentPipelineStatus,
  mapPublicationToQueueSection,
} from "@/lib/organic-social/performance-state";
import type {
  FormatPerformanceItem,
  OrganicChannelMetrics,
  OrganicConnectionState,
  OrganicSocialWorkspaceData,
  ReelItem,
} from "@/lib/organic-social/types";
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
  OrganicChannelPerformance,
} from "@/lib/marketing-intelligence/types";
import { buildTenantContextForUser } from "@/lib/tenancy/guards";
import { latestOrganicSyncAt } from "@/server/services/marketing-command-centre-metrics";
import { paidAdsDashboardService } from "@/server/services/paid-ads-dashboard-service";
import { publicationService } from "@/server/services/publication-service";
import { socialAnalyticsQueryService } from "@/server/services/social-analytics-query-service";
import { socialConnectionService } from "@/server/services/social-connection-service";
import { workspaceService } from "@/server/services/workspace-service";

const ORGANIC_CHANNELS: Array<{
  provider: SocialProvider;
  title: string;
  ctaLabel: string;
  ctaHref: string;
  connectLabel: string;
  reelLabel?: string;
}> = [
  {
    provider: "INSTAGRAM",
    title: "Instagram",
    ctaLabel: "Create Reel",
    ctaHref: "/content/studio/new?format=reel",
    connectLabel: "Connect Instagram",
    reelLabel: "Reel",
  },
  {
    provider: "TIKTOK",
    title: "TikTok",
    ctaLabel: "Create Video",
    ctaHref: "/content/studio/new?format=short_video",
    connectLabel: "Connect TikTok",
    reelLabel: "Video",
  },
  {
    provider: "YOUTUBE",
    title: "YouTube",
    ctaLabel: "Create Short",
    ctaHref: "/content/studio/new?format=short_video",
    connectLabel: "Connect YouTube",
    reelLabel: "Short",
  },
  {
    provider: "LINKEDIN",
    title: "LinkedIn",
    ctaLabel: "Create Post",
    ctaHref: "/content/studio/new",
    connectLabel: "Connect LinkedIn",
  },
  {
    provider: "FACEBOOK",
    title: "Facebook",
    ctaLabel: "Create Post",
    ctaHref: "/content/studio/new",
    connectLabel: "Connect Facebook",
    reelLabel: "Reel",
  },
];

const PROVIDER_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  LINKEDIN: "LinkedIn",
  FACEBOOK: "Facebook",
  X: "X",
};

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-GB");
}

function mapConnectionState(
  connected: boolean,
  status?: string,
  lastError?: string | null,
  lastSync?: string | null,
): OrganicConnectionState {
  if (!connected) return "Disconnected";
  if (status === "RECONNECT_REQUIRED" || lastError) return "Needs re-authentication";
  if (status === "PERMISSION_MISSING") return "Permission missing";
  if (lastSync) {
    const freshness = resolveDataFreshness(new Date(lastSync));
    if (freshness === "delayed" || freshness === "stale") return "Sync delayed";
  }
  return connected ? "Connected" : "Unavailable";
}

function buildEmptyWorkspace(range: ResolvedMarketingDateRange): OrganicSocialWorkspaceData {
  return {
    hasBrandContext: false,
    dateRange: {
      label: range.label,
      comparisonLabel: range.comparisonLabel,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    },
    freshness: { label: "Connection required", state: "unavailable" },
    coverage: "0 organic channels connected",
    partialCoverageNote: null,
    primaryCta: { label: "Connect Channel", href: "/social/connections" },
    executiveKpis: [],
    channels: [],
    chart: { reach: [], views: [], engagement: [], engagementRate: [] },
    formatPerformance: [],
    topContent: [],
    lowPerformingContent: [],
    contentPipeline: [],
    reels: { drafts: [], ready: [], scheduled: [], published: [], topPerforming: [] },
    publishingQueue: [],
    consistency: { score: 0, channels: [] },
    scheduleGaps: [],
    postingWindows: [],
    publishRecommendation: null,
    insights: [],
  };
}

function buildChartSeries(
  series: Array<Record<string, string | number>>,
  metric: string,
): Array<{ label: string; value: number }> {
  return series.map((point) => ({
    label: String(point.period),
    value: Number(point[metric] ?? 0),
  }));
}

export const organicSocialWorkspaceService = {
  async getWorkspace(
    userProfileId: string,
    rangeInput?: Partial<ResolvedMarketingDateRange>,
  ): Promise<OrganicSocialWorkspaceData> {
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
      socialOverview,
      previousSocialOverview,
      formatAttribution,
      socialCatalogue,
      publications,
      contentItems,
      organicSyncAt,
      paidCampaigns,
      upcomingSchedules,
    ] = await Promise.all([
      socialAnalyticsQueryService
        .overview(brandId, organisationId, { from: range.from, to: range.to }, tenant)
        .catch(() => null),
      socialAnalyticsQueryService
        .overview(
          brandId,
          organisationId,
          { from: range.comparisonFrom, to: range.comparisonTo },
          tenant,
        )
        .catch(() => null),
      socialAnalyticsQueryService
        .attribution(
          brandId,
          organisationId,
          { from: range.from, to: range.to },
          "CONTENT_TYPE",
          tenant,
        )
        .then((result) => result.groups)
        .catch(() => []),
      socialConnectionService.getCatalogue(brandId, organisationId, tenant).catch(() => []),
      publicationService.list(brandId, organisationId, tenant).catch(() => []),
      prisma.contentItem
        .findMany({
          where: { brandId, organisationId, archivedAt: null },
          include: { variants: true },
          orderBy: { updatedAt: "desc" },
          take: 100,
        })
        .catch(() => []),
      latestOrganicSyncAt(brandId, organisationId),
      paidAdsDashboardService
        .getCampaigns(brandId, organisationId, range.from, range.to, tenant)
        .catch(() => []),
      prisma.contentSchedule
        .findMany({
          where: {
            brandId,
            organisationId,
            scheduledFor: { gte: new Date() },
            status: { in: ["READY", "QUEUED", "PROCESSING"] },
          },
          take: 50,
        })
        .catch(() => []),
    ]);

    const connectedProviders = new Set(
      socialCatalogue
        .filter((item) => item.connection?.status === "CONNECTED")
        .map((item) => item.provider),
    );
    const connectedCount = connectedProviders.size;
    const reportingCount = socialOverview?.accountsMeasured ?? 0;
    const freshnessState = resolveDataFreshness(organicSyncAt);
    const freshnessLabel = formatFreshnessLabel(freshnessState, organicSyncAt);
    const showComparison = range.comparison !== "none";

    const totalReach = socialOverview?.totals?.reach ?? null;
    const previousReach = previousSocialOverview?.totals?.reach ?? null;
    const totalViews =
      socialOverview?.totals?.views ?? socialOverview?.totals?.videoViews ?? null;
    const previousViews =
      previousSocialOverview?.totals?.views ??
      previousSocialOverview?.totals?.videoViews ??
      null;
    const totalEngagement =
      socialOverview?.totals != null
        ? (socialOverview.totals.likes ?? 0) +
          (socialOverview.totals.comments ?? 0) +
          (socialOverview.totals.shares ?? 0) +
          (socialOverview.totals.saves ?? 0)
        : null;
    const previousEngagement =
      previousSocialOverview?.totals != null
        ? (previousSocialOverview.totals.likes ?? 0) +
          (previousSocialOverview.totals.comments ?? 0) +
          (previousSocialOverview.totals.shares ?? 0) +
          (previousSocialOverview.totals.saves ?? 0)
        : null;
    const engagementRate = socialOverview?.derived?.engagementRate ?? null;
    const publishedInRange = publications.filter((item) => item.status === "PUBLISHED").length;
    const scheduledUpcoming = upcomingSchedules.length;
    const followerGrowth = socialOverview?.derived?.followerGrowth ?? null;

    const coverage =
      connectedCount > 0
        ? `${reportingCount} of ${connectedCount} connected channels reporting`
        : "0 organic channels connected";

    const partialCoverageNote =
      connectedCount > reportingCount && connectedCount > 0
        ? `${connectedCount - reportingCount} connected channel(s) have unavailable analytics.`
        : socialOverview == null && connectedCount > 0
          ? "Organic analytics unavailable for one or more connected providers."
          : null;

    const primaryCta =
      connectedCount === 0
        ? { label: "Connect Channel", href: "/social/connections" }
        : scheduledUpcoming > 0
          ? { label: "Publish", href: "/publishing" }
          : { label: "Create Content", href: "/content/studio/new" };

    const executiveKpis = [
      {
        label: "Organic Reach",
        value: formatMetricValue(connectedCount > 0 ? totalReach : null, formatNumber),
        change: showComparison ? percentChange(totalReach ?? 0, previousReach ?? 0) : null,
        comparisonLabel: range.comparisonLabel,
        footnote: partialCoverageNote ?? undefined,
      },
      {
        label: "Views",
        value: formatMetricValue(connectedCount > 0 ? totalViews : null, formatNumber),
        change: showComparison ? percentChange(totalViews ?? 0, previousViews ?? 0) : null,
        comparisonLabel: range.comparisonLabel,
      },
      {
        label: "Engagement",
        value: formatMetricValue(connectedCount > 0 ? totalEngagement : null, formatNumber),
        change: showComparison
          ? percentChange(totalEngagement ?? 0, previousEngagement ?? 0)
          : null,
        comparisonLabel: range.comparisonLabel,
      },
      {
        label: "Engagement Rate",
        value:
          engagementRate != null ? `${engagementRate.toFixed(2)}%` : unavailableValue(),
        change: null,
        comparisonLabel: range.comparisonLabel,
      },
      {
        label: "Content Published",
        value: connectedCount > 0 ? String(publishedInRange) : unavailableValue(),
        change: null,
        comparisonLabel: range.comparisonLabel,
      },
      {
        label: "Follower Growth",
        value: formatMetricValue(
          connectedCount > 0 ? followerGrowth : null,
          (value) => (value >= 0 ? `+${formatNumber(value)}` : formatNumber(value)),
        ),
        change: null,
        comparisonLabel: range.comparisonLabel,
      },
      {
        label: "Scheduled Content",
        value: connectedCount > 0 ? String(scheduledUpcoming) : unavailableValue(),
        change: null,
        comparisonLabel: range.comparisonLabel,
      },
    ];

    const channels: OrganicChannelMetrics[] = ORGANIC_CHANNELS.map((channel) => {
      const catalogue = socialCatalogue.find((item) => item.provider === channel.provider);
      const connected = connectedProviders.has(channel.provider);
      const providerMetrics = socialOverview?.byProvider?.[channel.provider];
      const engagement =
        providerMetrics != null
          ? (providerMetrics.likes ?? 0) +
            (providerMetrics.comments ?? 0) +
            (providerMetrics.shares ?? 0) +
            (providerMetrics.saves ?? 0)
          : null;
      const impressions = providerMetrics?.impressions ?? null;
      const reach = providerMetrics?.reach ?? null;
      const views = providerMetrics?.views ?? providerMetrics?.videoViews ?? null;
      const channelEngagementRate =
        impressions && impressions > 0 && engagement != null
          ? (engagement / impressions) * 100
          : null;
      const lastSync = catalogue?.connection?.lastValidatedAt ?? null;
      const connectionState = mapConnectionState(
        connected,
        catalogue?.connection?.reconnectRequiredAt ? "RECONNECT_REQUIRED" : catalogue?.connection?.status,
        catalogue?.connection?.missingScopes?.length ? "missing" : null,
        lastSync,
      );
      const channelFreshness = resolveDataFreshness(lastSync ? new Date(lastSync) : null);
      const publishedContent = publications.filter(
        (item) =>
          item.status === "PUBLISHED" && item.providerKey.includes(channel.provider),
      ).length;
      const scheduledContent = publications.filter(
        (item) =>
          (item.status === "SCHEDULED" || item.status === "QUEUED") &&
          item.providerKey.includes(channel.provider),
      ).length;

      return {
        provider: channel.provider,
        channel: channel.title,
        connectionState,
        connected,
        reach: connected ? reach : null,
        impressions: connected ? impressions : null,
        views: connected ? views : null,
        engagement: connected ? engagement : null,
        engagementRate: connected ? channelEngagementRate : null,
        likes: connected ? (providerMetrics?.likes ?? null) : null,
        comments: connected ? (providerMetrics?.comments ?? null) : null,
        shares: connected ? (providerMetrics?.shares ?? null) : null,
        saves: connected ? (providerMetrics?.saves ?? null) : null,
        followers: connected ? (providerMetrics?.follows ?? providerMetrics?.subscribers ?? null) : null,
        followerGrowth: null,
        publishedContent,
        scheduledContent,
        reelsPublished: null,
        freshness: connected ? channelFreshness : "unavailable",
        freshnessLabel: connected
          ? formatFreshnessLabel(channelFreshness, lastSync ? new Date(lastSync) : null)
          : "Disconnected",
        unavailableMetrics:
          connected && !providerMetrics ? ["reach", "engagement"] : [],
        ctaLabel: connected ? channel.ctaLabel : channel.connectLabel,
        ctaHref: connected ? channel.ctaHref : "/social/connections",
        connectHref: "/social/connections",
      };
    });

    const formatPerformance: FormatPerformanceItem[] = formatAttribution.map((group) => {
      const engagement =
        (group.totals?.likes ?? 0) +
        (group.totals?.comments ?? 0) +
        (group.totals?.shares ?? 0) +
        (group.totals?.saves ?? 0);
      return {
        format: group.label ?? group.key ?? "Unknown",
        contentCount: group.postsMeasured ?? 0,
        averageReach:
          group.postsMeasured > 0 && group.totals?.reach != null
            ? group.totals.reach / group.postsMeasured
            : null,
        averageEngagement: engagement > 0 ? engagement : null,
        engagementRate: group.derived?.engagementRate ?? null,
        averageViews:
          group.postsMeasured > 0 && group.totals?.views != null
            ? group.totals.views / group.postsMeasured
            : group.derived?.averageViewsPerPost ?? null,
      };
    });

    const baselineEngagementRate = engagementRate;

    const contentPipelineMap = new Map<string, number>();
    for (const item of contentItems) {
      const status = mapContentPipelineStatus(item.status);
      contentPipelineMap.set(status, (contentPipelineMap.get(status) ?? 0) + 1);
    }
    const contentPipeline = [...contentPipelineMap.entries()].map(([status, count]) => ({
      status: status as OrganicSocialWorkspaceData["contentPipeline"][number]["status"],
      count,
    }));

    const shortFormItems = contentItems.filter(
      (item) =>
        item.contentType === "SHORT_VIDEO" ||
        item.studioType === "VIDEO_SCRIPT" ||
        item.title.toLowerCase().includes("reel") ||
        item.title.toLowerCase().includes("short"),
    );

    const contentTitleById = new Map(contentItems.map((item) => [item.id, item.title]));

    const toReelItem = (item: (typeof contentItems)[number]): ReelItem => {
      const pipelineStatus = mapContentPipelineStatus(item.status);
      return {
        id: item.id,
        title: item.title,
        duration:
          item.variants.find((variant) => variant.durationSeconds != null)?.durationSeconds != null
            ? `${item.variants.find((variant) => variant.durationSeconds != null)?.durationSeconds}s`
            : null,
        channels: item.variants
          .map((variant) => (variant.provider ? PROVIDER_LABELS[variant.provider] ?? variant.provider : null))
          .filter((value): value is string => value != null),
        captionStatus: item.variants.some((variant) => variant.caption || variant.channelBody)
          ? "Complete"
          : "Draft",
        publishingStatus: pipelineStatus,
        scheduledAt: null,
        views: null,
        engagement: null,
        shares: null,
        saves: null,
        performanceState: "Insufficient data",
        fatigueDetected: false,
      };
    };

    const reels = {
      drafts: shortFormItems
        .filter((item) => ["IDEA", "DRAFT", "BRIEF", "IN_REVIEW", "CHANGES_REQUESTED"].includes(item.status))
        .map(toReelItem),
      ready: shortFormItems
        .filter((item) => ["APPROVED", "READY"].includes(item.status))
        .map(toReelItem),
      scheduled: shortFormItems
        .filter((item) => item.status === "SCHEDULED")
        .map(toReelItem),
      published: shortFormItems
        .filter((item) => ["PUBLISHED", "PARTIALLY_PUBLISHED"].includes(item.status))
        .map(toReelItem),
      topPerforming: [],
    };

    const currentBrand = workspace.brands.find(
      (item) => item.id === workspace.preference.currentBrandId,
    );

    const publishingQueue = publications.slice(0, 50).map((item) => ({
      id: item.id,
      title: contentTitleById.get(item.contentItemId) ?? "Untitled",
      channel: PROVIDER_LABELS[item.providerKey] ?? item.providerKey,
      brand: currentBrand?.name ?? "Brand",
      section: mapPublicationToQueueSection(item.status),
      scheduledAt: item.scheduledFor,
      failureReason: item.lastErrorMessage,
      canRetry: item.status === "FAILED",
      previewHref: item.contentItemId ? `/content/studio/${item.contentItemId}` : null,
    }));

    const periodDays = Math.max(
      1,
      Math.ceil((range.to.getTime() - range.from.getTime()) / 86_400_000),
    );
    const consistency = calculatePublishingConsistencyScore({
      channels: channels
        .filter((channel) => channel.connected)
        .map((channel) => ({
          channel: channel.channel,
          published: channel.publishedContent,
          scheduled: channel.scheduledContent,
          periodDays,
          connected: channel.connected,
        })),
    });

    const scheduleGaps = detectScheduleGaps({
      channels: channels.map((channel) => ({
        channel: channel.channel,
        connected: channel.connected,
        scheduledContent: channel.scheduledContent,
        reelsScheduled: 0,
        formatLabel: channel.channel === "Instagram" ? "Reel" : undefined,
      })),
    });

    const organicChannelsDetailed: OrganicChannelPerformance[] = ORGANIC_CHANNELS.map(
      (channel) => {
        const providerMetrics = socialOverview?.byProvider?.[channel.provider];
        const connected = connectedProviders.has(channel.provider);
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
            (item) =>
              item.status === "PUBLISHED" && item.providerKey.includes(channel.provider),
          ).length,
          scheduled: publications.filter(
            (item) =>
              item.status === "SCHEDULED" && item.providerKey.includes(channel.provider),
          ).length,
          dataFreshness: organicSyncAt,
          unavailableMetrics: connected && !providerMetrics ? ["reach", "engagement"] : [],
        };
      },
    );

    const topPaidCreatives = paidCampaigns
      .filter((campaign) => campaign.conversions > 0)
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 3)
      .map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        provider: campaign.provider,
        roas: null,
        conversions: campaign.conversions,
      }));

    const intelligenceContext: MarketingIntelligenceContext = {
      rangeLabel: range.label,
      comparisonLabel: range.comparisonLabel,
      paid: {
        connectedCount: 0,
        totalProviders: 4,
        spend: 0,
        previousSpend: 0,
        conversions: 0,
        previousConversions: 0,
        revenue: 0,
        previousRevenue: 0,
        roas: null,
        previousRoas: null,
        cpa: null,
        previousCpa: null,
        byProvider: [],
        freshness: "unavailable",
        lastSyncedAt: null,
      },
      organic: {
        connectedCount,
        totalProviders: ORGANIC_CHANNELS.length,
        reach: totalReach,
        previousReach,
        engagement: totalEngagement,
        previousEngagement,
        engagementRate,
        published: publishedInRange,
        scheduled: scheduledUpcoming,
        channels: organicChannelsDetailed,
        freshness: freshnessState,
        lastSyncedAt: organicSyncAt,
        partialCoverageNote: partialCoverageNote ?? undefined,
      },
      publishing: {
        publishedInRange,
        scheduledUpcoming,
        daysWithoutScheduled: scheduledUpcoming === 0 ? 5 : 0,
        strongestOrganicFormat:
          formatPerformance.sort(
            (a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0),
          )[0]?.format ?? null,
      },
      connectivity: {
        paidConnected: 0,
        paidTotal: 4,
        organicConnected: connectedCount,
        organicTotal: ORGANIC_CHANNELS.length,
      },
      formatPerformance: formatPerformance.map((item) => ({
        format: item.format,
        contentCount: item.contentCount,
        averageEngagementRate: item.engagementRate,
        averageReach: item.averageReach,
      })),
      topOrganicContent: [],
      topPaidCreatives,
      scheduleGaps,
    };

    const insights = evaluateMarketingSignals(intelligenceContext)
      .filter((signal) => signal.category === "organic" || signal.category === "cross-channel")
      .slice(0, 5);

    const leaderFormat = formatPerformance.sort(
      (a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0),
    )[0];
    const publishRecommendation =
      leaderFormat && scheduleGaps.length > 0
        ? {
            format: leaderFormat.format,
            channel: scheduleGaps[0]?.channel ?? "Instagram",
            reason: `${leaderFormat.format} outperforms other formats, and ${scheduleGaps[0]?.message.toLowerCase() ?? "a publishing gap exists"}.`,
          }
        : leaderFormat
          ? {
              format: leaderFormat.format,
              channel: "Instagram",
              reason: `${leaderFormat.format} generated the highest engagement rate in the selected period.`,
            }
          : null;

    const chart = {
      reach: buildChartSeries(socialOverview?.series ?? [], "reach"),
      views: buildChartSeries(socialOverview?.series ?? [], "views"),
      engagement: buildChartSeries(socialOverview?.series ?? [], "likes"),
      engagementRate: [],
    };

    return {
      hasBrandContext: true,
      dateRange: {
        label: range.label,
        comparisonLabel: range.comparisonLabel,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      freshness: { label: freshnessLabel, state: freshnessState },
      coverage,
      partialCoverageNote,
      primaryCta,
      executiveKpis,
      channels,
      chart,
      formatPerformance,
      topContent: [],
      lowPerformingContent: [],
      contentPipeline,
      reels,
      publishingQueue,
      consistency,
      scheduleGaps,
      postingWindows: calculateBestPostingWindows([], baselineEngagementRate),
      publishRecommendation,
      insights,
    };
  },
};

export type { OrganicSocialWorkspaceData };
