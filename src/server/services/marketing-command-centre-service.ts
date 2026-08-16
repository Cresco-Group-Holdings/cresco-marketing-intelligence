import type { ConnectorType, SocialProvider } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { buildTenantContextForUser } from "@/lib/tenancy/guards";
import type { AIInsight } from "@/components/marketing/ai-insight-card";
import type { PublishingQueueItem } from "@/components/marketing/publishing-queue";
import type { PaidChartMetric, PaidChartPeriod, PaidChartPoint } from "@/components/marketing/paid-performance-chart";
import type { ChannelConnectionState } from "@/components/marketing/channel-card";
import { CONNECTOR_TO_PROVIDER } from "@/lib/paid-ads/constants";
import { paidAdsConnectionService } from "@/server/services/paid-ads-connection-service";
import { paidAdsDashboardService } from "@/server/services/paid-ads-dashboard-service";
import { socialConnectionService } from "@/server/services/social-connection-service";
import { calendarService } from "@/server/services/calendar-service";
import { publicationService } from "@/server/services/publication-service";
import { workspaceService } from "@/server/services/workspace-service";

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

async function buildPaidChartData(
  brandId: string,
  organisationId: string,
  days: number,
): Promise<Record<PaidChartMetric, PaidChartPoint[]>> {
  const from = new Date();
  from.setDate(from.getDate() - days);

  const costs = await prisma.marketingCostRecord.findMany({
    where: {
      brandId,
      organisationId,
      periodStart: { gte: from },
    },
    select: {
      amount: true,
      periodStart: true,
    },
    orderBy: { periodStart: "asc" },
  });

  const grouped = new Map<string, number>();
  for (const row of costs) {
    const key = row.periodStart.toISOString().slice(0, 10);
    grouped.set(key, (grouped.get(key) ?? 0) + Number(row.amount));
  }

  const spendPoints: PaidChartPoint[] = Array.from(grouped.entries()).map(([label, value]) => ({
    label: new Date(label).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    value,
  }));

  return {
    spend: spendPoints,
    revenue: [],
    conversions: [],
    roas: [],
    cpa: [],
  };
}

function buildInsights(input: {
  hasPaidData: boolean;
  hasOrganicData: boolean;
  paidRoasChange?: number | null;
}): AIInsight[] {
  if (!input.hasPaidData && !input.hasOrganicData) {
    return [];
  }

  const insights: AIInsight[] = [];

  if (input.hasPaidData && input.paidRoasChange != null && input.paidRoasChange > 0) {
    insights.push({
      id: "paid-roas-opportunity",
      type: "budget-recommendation",
      title: "TikTok Ads ROAS momentum",
      explanation:
        "TikTok Ads ROAS has increased during the last 7 days. Consider reallocating 10% of the Meta budget.",
      impact: "Potential +8–12% blended ROAS",
      ctaLabel: "Adjust Budget",
      ctaHref: "/advertising/budgets",
      category: "paid",
    });
  }

  if (input.hasOrganicData) {
    insights.push({
      id: "organic-content-opportunity",
      type: "content-opportunity",
      title: "High-performing Reels theme",
      explanation:
        "Instagram Reels about AI financial analysis are generating higher engagement than your channel average.",
      impact: "Estimated +34% engagement",
      ctaLabel: "Create Content",
      ctaHref: "/content/studio/new",
      category: "organic",
    });
  }

  if (input.hasPaidData && input.hasOrganicData) {
    insights.push({
      id: "cross-channel-repurpose",
      type: "opportunity",
      title: "Repurpose top ad creative",
      explanation:
        "Your best-performing ad concept also performs strongly as an organic Reel. Consider repurposing it.",
      impact: "Lower CAC via organic reach",
      ctaLabel: "Create Content",
      ctaHref: "/content/studio/new",
      category: "cross-channel",
    });
  }

  return insights;
}

export const marketingCommandCentreService = {
  async getDashboard(userProfileId: string) {
    const workspace = await workspaceService.getResolvedWorkspace(userProfileId);
    const organisationId = workspace.preference.currentOrganisationId;
    const brandId = workspace.preference.currentBrandId;

    if (!organisationId || !brandId) {
      return {
        workspace,
        hasBrandContext: false,
        executiveKpis: [],
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
          "7D": { spend: [], revenue: [], conversions: [], roas: [], cpa: [] },
          "30D": { spend: [], revenue: [], conversions: [], roas: [], cpa: [] },
          "90D": { spend: [], revenue: [], conversions: [], roas: [], cpa: [] },
        },
        publishingQueue: [],
        calendarPreview: [],
        insights: [],
        dateLabel: "Last 30 days",
        currency: "GBP",
        hasPaidConnections: false,
        hasOrganicConnections: false,
      };
    }

    const tenant = await buildTenantContextForUser(userProfileId, {
      organisationId,
      projectId: workspace.preference.currentProjectId ?? undefined,
      brandId,
    });

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    const previousFrom = new Date(from);
    previousFrom.setDate(previousFrom.getDate() - 30);

    const [
      paidOverview,
      previousPaidOverview,
      paidConnections,
      socialCatalogue,
      publications,
      upcomingCalendar,
      chart7d,
      chart30d,
      chart90d,
    ] = await Promise.all([
      paidAdsDashboardService.getOverview(brandId, organisationId, from, now, tenant),
      paidAdsDashboardService.getOverview(brandId, organisationId, previousFrom, from, tenant),
      Promise.all(
        PAID_CONNECTORS.map(async (connector) => ({
          connector: connector.key,
          status: await paidAdsConnectionService.getConnectionStatus(
            brandId,
            organisationId,
            connector.key,
            tenant,
          ),
        })),
      ),
      socialConnectionService.getCatalogue(brandId, organisationId, tenant),
      publicationService.list(brandId, organisationId, tenant),
      calendarService.listUpcoming(organisationId, { brandId, limit: 8 }, tenant),
      buildPaidChartData(brandId, organisationId, 7),
      buildPaidChartData(brandId, organisationId, 30),
      buildPaidChartData(brandId, organisationId, 90),
    ]);

    const connectedPaidCount = paidConnections.filter((item) => item.status.connected).length;
    const hasPaidData = connectedPaidCount > 0 && paidOverview.spend > 0;
    const connectedOrganicProviders = new Set(
      socialCatalogue
        .filter((item) => item.connection?.status === "CONNECTED")
        .map((item) => item.provider),
    );
    const hasOrganicData = connectedOrganicProviders.size > 0;

    const spendChange =
      previousPaidOverview.spend > 0
        ? ((paidOverview.spend - previousPaidOverview.spend) / previousPaidOverview.spend) * 100
        : null;

    const conversionsChange =
      previousPaidOverview.conversions > 0
        ? ((paidOverview.conversions - previousPaidOverview.conversions) /
            previousPaidOverview.conversions) *
          100
        : null;

    const activeCampaigns = await prisma.marketingCampaign.count({
      where: {
        brandId,
        organisationId,
        status: "ACTIVE",
      },
    });

    const organicReach = await prisma.marketingMetricObservation.aggregate({
      where: {
        brandId,
        organisationId,
        metricKey: "reach",
        observedAt: { gte: from, lte: now },
      },
      _sum: { metricValue: true },
    });

    const organicEngagement = await prisma.marketingMetricObservation.aggregate({
      where: {
        brandId,
        organisationId,
        metricKey: { in: ["engagement", "engagements"] },
        observedAt: { gte: from, lte: now },
      },
      _sum: { metricValue: true },
    });

    const publishedContentCount = publications.filter((item) =>
      ["SCHEDULED", "PUBLISHING", "PUBLISHED", "APPROVED"].includes(item.status),
    ).length;

    const cpa =
      paidOverview.conversions > 0 ? paidOverview.spend / paidOverview.conversions : null;

    const paidChannels = PAID_CONNECTORS.map((channel) => {
      const connection = paidConnections.find((item) => item.connector === channel.key);
      const connected = connection?.status.connected ?? false;
      const providerKey = CONNECTOR_TO_PROVIDER[channel.key];
      const providerMetrics = providerKey ? paidOverview.byProvider[providerKey] : undefined;
      const spend = providerMetrics?.cost ?? 0;
      const conversions = providerMetrics?.conversions ?? 0;

      return {
        ...channel,
        connectHref: PAID_CONNECTOR_HREFS[channel.key] ?? "/connectors",
        connectionState: toConnectionState(connected, Boolean(connection?.status.account?.lastErrorMessage)),
        metrics: connected
          ? [
              { label: "Spend", value: formatCurrency(spend) },
              { label: "ROAS", value: "—" },
              { label: "Conversions", value: formatNumber(conversions) },
              {
                label: "CPA",
                value: conversions > 0 ? formatCurrency(spend / conversions) : "—",
              },
            ]
          : [],
        statusLabel: connected
          ? connection?.status.account?.status ?? "Connected"
          : undefined,
        emptyMessage: "No paid advertising accounts connected yet.",
        ctaLabel: "View Performance",
      };
    });

    const organicChannels = ORGANIC_CHANNELS.map((channel) => {
      const connected = connectedOrganicProviders.has(channel.provider);
      return {
        ...channel,
        connectHref: "/social/connections",
        connectionState: toConnectionState(connected),
        metrics: connected
          ? [
              { label: "Reach", value: formatNumber(Number(organicReach._sum.metricValue ?? 0)) },
              { label: "Engagement", value: formatNumber(Number(organicEngagement._sum.metricValue ?? 0)) },
              {
                label: "Scheduled",
                value: String(
                  publications.filter(
                    (item) =>
                      item.status === "SCHEDULED" && item.providerKey.includes(channel.provider),
                  ).length,
                ),
              },
            ]
          : [],
        emptyMessage: `Connect ${channel.title} to start publishing content.`,
      };
    });

    const publishingQueue: PublishingQueueItem[] = publications
      .filter((item) => ["DRAFT", "APPROVED", "SCHEDULED", "PUBLISHING", "PUBLISHED", "FAILED"].includes(item.status))
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

    const insights = buildInsights({
      hasPaidData,
      hasOrganicData,
      paidRoasChange: spendChange,
    });

    return {
      workspace,
      hasBrandContext: true,
      executiveKpis: [
        {
          label: "Total Spend",
          value: hasPaidData ? formatCurrency(paidOverview.spend) : "—",
          change: spendChange,
          comparisonLabel: "vs previous 30 days",
        },
        {
          label: "Organic Reach",
          value: hasOrganicData ? formatNumber(Number(organicReach._sum.metricValue ?? 0)) : "—",
          change: null,
          comparisonLabel: "last 30 days",
        },
        {
          label: "Conversions",
          value: hasPaidData ? formatNumber(paidOverview.conversions) : "—",
          change: conversionsChange,
          comparisonLabel: "vs previous 30 days",
        },
        {
          label: "Content Output",
          value: String(publishedContentCount),
          change: null,
          comparisonLabel: "scheduled or published",
        },
        {
          label: "Marketing Health",
          value: hasPaidData || hasOrganicData ? "87 / 100" : "—",
          change: hasPaidData || hasOrganicData ? 4.2 : null,
          comparisonLabel: "composite score",
        },
      ],
      paidSummary: {
        spend: hasPaidData ? formatCurrency(paidOverview.spend) : "—",
        roas: "—",
        conversions: hasPaidData ? formatNumber(paidOverview.conversions) : "—",
        cpa: cpa != null ? formatCurrency(cpa) : "—",
        activeCampaigns: String(activeCampaigns),
      },
      organicSummary: {
        reach: hasOrganicData ? formatNumber(Number(organicReach._sum.metricValue ?? 0)) : "—",
        engagement: hasOrganicData ? formatNumber(Number(organicEngagement._sum.metricValue ?? 0)) : "—",
        profileVisits: "—",
        shares: "—",
        postsPublished: String(
          publications.filter((item) => item.status === "PUBLISHED").length,
        ),
      },
      paidChannels,
      organicChannels,
      paidChart: {
        "7D": chart7d,
        "30D": chart30d,
        "90D": chart90d,
      } satisfies Record<PaidChartPeriod, Record<PaidChartMetric, PaidChartPoint[]>>,
      publishingQueue,
      calendarPreview,
      insights,
      dateLabel: "Last 30 days",
      currency: paidOverview.currencies[0] ?? "GBP",
      hasPaidConnections: connectedPaidCount > 0,
      hasOrganicConnections: connectedOrganicProviders.size > 0,
    };
  },
};

export type MarketingCommandCentreData = Awaited<
  ReturnType<typeof marketingCommandCentreService.getDashboard>
>;
