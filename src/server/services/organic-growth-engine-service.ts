import { calculateOrganicGrowthScore } from "@/lib/organic-growth/growth-score";
import { buildOrganicOpportunities, pickTopOpportunity } from "@/lib/organic-growth/opportunities";
import { mergeProviderRegistryWithConnections } from "@/lib/organic-growth/providers";
import type {
  AccountHealthState,
  OrganicAccountRow,
  OrganicContentPerformanceItem,
  OrganicExecutiveKpi,
  OrganicGrowthEngineData,
  OrganicPublishingQueueItem,
  PublishingQueueStatus,
} from "@/lib/organic-growth/types";
import { detectWinningContent } from "@/lib/organic-growth/winning-content";
import type { ResolvedMarketingDateRange } from "@/lib/marketing/date-range";
import { resolveMarketingDateRange } from "@/lib/marketing/date-range";
import { organicSocialWorkspaceService } from "@/server/services/organic-social-workspace-service";

function mapConnectionToHealth(state: string): AccountHealthState {
  switch (state) {
    case "Connected":
      return "healthy";
    case "Needs re-authentication":
      return "reauth_required";
    case "Sync delayed":
      return "stale";
    case "Permission missing":
    case "Unavailable":
      return "error";
    case "Disconnected":
    default:
      return "not_connected";
  }
}

function mapQueueSection(section: string): PublishingQueueStatus {
  switch (section) {
    case "Ready":
      return "approved";
    case "Scheduled":
      return "scheduled";
    case "Publishing":
      return "publishing";
    case "Published":
      return "published";
    case "Failed":
      return "failed";
    default:
      return "draft";
  }
}

const UNAVAILABLE = "—";

function buildExecutiveKpis(
  workspace: Awaited<ReturnType<typeof organicSocialWorkspaceService.getWorkspace>>,
): OrganicExecutiveKpi[] {
  const reach = workspace.executiveKpis.find((k) => k.label === "Organic Reach");
  const engagement = workspace.executiveKpis.find((k) => k.label === "Engagement");
  const followerGrowth = workspace.executiveKpis.find((k) => k.label === "Follower Growth");

  return [
    {
      label: "Organic Reach",
      value: reach?.value ?? UNAVAILABLE,
      change: reach?.change ?? null,
      comparisonLabel: workspace.dateRange.comparisonLabel,
      state: reach?.value === UNAVAILABLE ? "empty" : "normal",
    },
    {
      label: "Engagements",
      value: engagement?.value ?? UNAVAILABLE,
      change: engagement?.change ?? null,
      comparisonLabel: workspace.dateRange.comparisonLabel,
      state: engagement?.value === UNAVAILABLE ? "empty" : "normal",
    },
    {
      label: "Follower Growth",
      value: followerGrowth?.value ?? UNAVAILABLE,
      change: followerGrowth?.change ?? null,
      comparisonLabel: workspace.dateRange.comparisonLabel,
      state: followerGrowth?.value === UNAVAILABLE ? "unavailable" : "normal",
    },
    {
      label: "Website Traffic",
      value: UNAVAILABLE,
      change: null,
      comparisonLabel: workspace.dateRange.comparisonLabel,
      state: "unavailable",
      stateMessage: "Connect analytics to track organic social referred sessions.",
    },
    {
      label: "Organic Conversions",
      value: UNAVAILABLE,
      change: null,
      comparisonLabel: workspace.dateRange.comparisonLabel,
      state: "unavailable",
      stateMessage: "Conversion attribution for organic social is not yet configured.",
    },
    {
      label: "Organic Growth Score",
      value: "—",
      change: null,
      comparisonLabel: workspace.dateRange.comparisonLabel,
      state: "partial",
    },
  ];
}

function buildAccounts(
  workspace: Awaited<ReturnType<typeof organicSocialWorkspaceService.getWorkspace>>,
): OrganicAccountRow[] {
  return workspace.channels.map((channel) => ({
    id: channel.provider,
    provider: channel.channel,
    providerKey: channel.provider,
    displayName: channel.channel,
    handle: null,
    connectionState: mapConnectionToHealth(channel.connectionState),
    connectionLabel: channel.connectionState,
    lastSyncAt: channel.freshnessLabel !== "Disconnected" ? channel.freshnessLabel : null,
    freshness: channel.freshness,
    freshnessLabel: channel.freshnessLabel,
    followers: channel.followers,
    followerGrowth: channel.followerGrowth,
    followerGrowthRate: null,
    reach: channel.reach,
    engagementRate: channel.engagementRate,
    publishingStatus:
      channel.scheduledContent > 0 ? "active" : channel.publishedContent > 0 ? "idle" : "none",
    scheduledCount: channel.scheduledContent,
    actions: {
      performanceHref: "/organic-social/content",
      createHref: channel.ctaHref,
      queueHref: "/organic-social/publishing",
      connectHref: "/organic-social/accounts",
    },
  }));
}

function buildContentPerformance(
  workspace: Awaited<ReturnType<typeof organicSocialWorkspaceService.getWorkspace>>,
  winningIds: Set<string>,
): OrganicContentPerformanceItem[] {
  return [...workspace.topContent, ...workspace.lowPerformingContent].map((item) => ({
    id: item.id,
    title: item.title,
    channel: item.channel ?? "—",
    format: item.format,
    theme: null,
    campaign: null,
    publishedAt: item.publishedAt,
    reach: null,
    impressions: null,
    engagements: item.engagement,
    engagementRate: null,
    clicks: null,
    profileVisits: null,
    followsGained: null,
    conversionsInfluenced: null,
    status: item.status,
    sourceContentId: null,
    isWinning: winningIds.has(item.id),
  }));
}

function buildPublishingQueue(
  workspace: Awaited<ReturnType<typeof organicSocialWorkspaceService.getWorkspace>>,
): OrganicPublishingQueueItem[] {
  return workspace.publishingQueue.map((item) => ({
    id: item.id,
    title: item.title,
    preview: null,
    channel: item.channel,
    accountName: item.brand,
    scheduledAt: item.scheduledAt,
    campaign: null,
    status: mapQueueSection(item.section),
    validationState: item.section === "Failed" ? "error" : "valid",
    validationMessage: item.failureReason,
    actions: [
      ...(item.previewHref ? [{ label: "View content", href: item.previewHref }] : []),
      ...(item.canRetry ? [{ label: "Retry", href: `/operations/publishing?retry=${item.id}` }] : []),
    ],
  }));
}

function buildEmptyEngine(range: ResolvedMarketingDateRange): OrganicGrowthEngineData {
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
    primaryCta: { label: "Connect accounts", href: "/organic-social/accounts" },
    executiveKpis: [],
    growthScore: calculateOrganicGrowthScore({
      publishingConsistencyScore: null,
      engagementRate: null,
      previousEngagementRate: null,
      followerGrowthRate: null,
      formatDiversityCount: 0,
      formatCount: 0,
      connectedChannelCount: 0,
      totalChannelSlots: 9,
      conversionContribution: null,
      communityEngagementScore: null,
      experimentCount: 0,
      scheduledUpcoming: 0,
      daysWithoutScheduled: null,
    }),
    accounts: [],
    priorities: [],
    topOpportunity: null,
    winningContent: [],
    opportunities: [],
    contentPerformance: [],
    publishingQueue: [],
    consistencyGaps: [],
    bestTimeWindows: [],
    communityOpportunities: [],
    insights: [],
    channelMetrics: [],
    providers: mergeProviderRegistryWithConnections(new Set(), new Map()),
  };
}

export const organicGrowthEngineService = {
  async getEngine(
    userProfileId: string,
    rangeInput?: Partial<ResolvedMarketingDateRange>,
  ): Promise<OrganicGrowthEngineData> {
    const range = resolveMarketingDateRange(rangeInput ?? { preset: "30d" });
    const workspace = await organicSocialWorkspaceService.getWorkspace(userProfileId, rangeInput);

    if (!workspace.hasBrandContext) {
      return buildEmptyEngine(range);
    }

    const connectedProviders = new Set(
      workspace.channels.filter((c) => c.connected).map((c) => c.provider),
    );
    const connectionStatus = new Map(
      workspace.channels.map((c) => [
        c.provider,
        { status: c.connectionState, lastSyncAt: null as Date | null },
      ]),
    );

    const performanceInputs = workspace.topContent.map((item) => ({
      id: item.id,
      title: item.title,
      channel: item.channel ?? "Unknown",
      format: item.format,
      theme: null,
      publishedAt: item.publishedAt,
      reach: null,
      engagements: item.engagement,
      engagementRate:
        item.engagement != null && item.engagement > 0 ? item.engagement / 100 : null,
      profileVisits: null,
      clicks: null,
    }));

    const winningContent = detectWinningContent(performanceInputs);
    const winningIds = new Set(winningContent.map((w) => w.id));

    const formatLeader = workspace.formatPerformance.sort(
      (a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0),
    )[0];
    const formatAverage =
      workspace.formatPerformance.reduce((sum, f) => sum + (f.engagementRate ?? 0), 0) /
      Math.max(1, workspace.formatPerformance.length);

    const opportunities = buildOrganicOpportunities({
      winningContent,
      scheduleGaps: workspace.scheduleGaps,
      postingWindows: workspace.postingWindows,
      underusedChannels: workspace.channels.map((c) => ({
        channel: c.channel,
        connected: c.connected,
        publishedCount: c.publishedContent,
      })),
      topFormat:
        formatLeader && formatAverage > 0
          ? {
              format: formatLeader.format,
              uplift: ((formatLeader.engagementRate ?? 0) / formatAverage - 1) * 100,
            }
          : null,
      topTheme: null,
    });

    const growthScore = calculateOrganicGrowthScore({
      publishingConsistencyScore: workspace.consistency.score,
      engagementRate: workspace.executiveKpis.find((k) => k.label === "Engagement Rate")
        ? parseFloat(
            workspace.executiveKpis.find((k) => k.label === "Engagement Rate")!.value.replace("%", ""),
          ) || null
        : null,
      previousEngagementRate: null,
      followerGrowthRate: null,
      formatDiversityCount: new Set(workspace.formatPerformance.map((f) => f.format)).size,
      formatCount: workspace.formatPerformance.reduce((sum, f) => sum + f.contentCount, 0),
      connectedChannelCount: connectedProviders.size,
      totalChannelSlots: 9,
      conversionContribution: null,
      communityEngagementScore: null,
      experimentCount: 0,
      scheduledUpcoming: workspace.publishingQueue.filter((p) => p.section === "Scheduled").length,
      daysWithoutScheduled:
        workspace.scheduleGaps.length > 0 ? 5 : workspace.publishingQueue.length === 0 ? 5 : 0,
    });

    const executiveKpis = buildExecutiveKpis(workspace);
    const growthScoreKpi = executiveKpis.find((k) => k.label === "Organic Growth Score");
    if (growthScoreKpi) {
      growthScoreKpi.value = `${growthScore.total} / ${growthScore.maxTotal}`;
      growthScoreKpi.state = growthScore.total > 0 ? "normal" : "partial";
    }

    const priorities = workspace.scheduleGaps.slice(0, 3).map((gap, index) => ({
      id: `organic-priority-${index}`,
      title: "Publishing gap detected",
      urgency: "high" as const,
      context: gap.message,
      action: { label: "Schedule content", href: "/calendar" },
    }));

    if (workspace.insights.length > 0) {
      const signal = workspace.insights[0]!;
      priorities.unshift({
        id: signal.id,
        title: signal.title,
        urgency: signal.severity === "high" ? "critical" : "high",
        context: signal.explanation,
        action: signal.action ?? { label: "Review", href: "/organic-social/intelligence" },
      });
    }

    return {
      hasBrandContext: workspace.hasBrandContext,
      dateRange: workspace.dateRange,
      freshness: workspace.freshness,
      coverage: workspace.coverage,
      partialCoverageNote: workspace.partialCoverageNote,
      primaryCta: {
        label: workspace.primaryCta.label,
        href: workspace.primaryCta.href.replace("/social/", "/organic-social/").replace("/publishing", "/organic-social/publishing"),
      },
      executiveKpis,
      growthScore,
      accounts: buildAccounts(workspace),
      priorities: priorities.slice(0, 5),
      topOpportunity: pickTopOpportunity(opportunities),
      winningContent,
      opportunities,
      contentPerformance: buildContentPerformance(workspace, winningIds),
      publishingQueue: buildPublishingQueue(workspace),
      consistencyGaps: workspace.scheduleGaps.map((g) => ({
        channel: g.channel,
        message: g.message,
      })),
      bestTimeWindows: workspace.postingWindows.map((w) => ({
        channel: w.channel,
        dayOfWeek: w.dayOfWeek,
        hourRange: w.hourRange,
        engagementLift: w.engagementLift,
        confidence: w.sampleSize >= 10 ? "medium" : "low",
        sampleSize: w.sampleSize,
        actionLabel: "Use this publishing window",
      })),
      communityOpportunities: [],
      insights: workspace.insights,
      channelMetrics: workspace.channels.map((c) => ({
        provider: c.provider,
        label: c.channel,
        reach: c.reach,
        engagementRate: c.engagementRate,
        followersGained: c.followerGrowth,
        clicks: null,
        connected: c.connected,
      })),
      providers: mergeProviderRegistryWithConnections(connectedProviders, connectionStatus),
    };
  },
};
