import type {
  ChannelPerformanceMetric,
  CommandCentreChannelRow,
  CommandCentreFunnelStage,
  OrganicChannelPerformanceMetric,
} from "@/lib/command-centre/types";
import type { OrganicChannelPerformance, PaidProviderMetrics } from "@/lib/marketing-intelligence/types";
import { percentChange, unavailableValue } from "@/lib/marketing-intelligence/format";

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

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function buildChannelPerformanceRows(
  providers: PaidProviderMetrics[],
  channels: Array<{
    key: string;
    label: string;
    href: string;
    connectHref: string;
    connected: boolean;
    hasError?: boolean;
  }>,
  metric: ChannelPerformanceMetric,
  currency: string,
  comparisonLabel?: string,
  previousProviders?: PaidProviderMetrics[],
): CommandCentreChannelRow[] {
  const maxSpend = Math.max(...providers.map((item) => item.spend), 1);

  return channels.map((channel) => {
    const current = providers.find((item) => item.provider === channel.label);
    const previous = previousProviders?.find((item) => item.provider === channel.label);
    const spend = current?.spend ?? 0;
    const conversions = current?.conversions ?? 0;
    const revenue = current?.revenue ?? 0;
    const clicks = current?.clicks ?? 0;
    const impressions = current?.impressions ?? 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
    const roas = spend > 0 ? revenue / spend : null;

    let metricValue = unavailableValue();
    let change: number | null = null;

    if (channel.connected) {
      switch (metric) {
        case "spend":
          metricValue = formatCurrency(spend, currency);
          change = percentChange(spend, previous?.spend ?? 0);
          break;
        case "roas":
          metricValue = roas != null ? `${roas.toFixed(2)}x` : unavailableValue();
          change =
            roas != null && previous && previous.spend > 0
              ? percentChange(roas, previous.revenue / previous.spend)
              : null;
          break;
        case "conversions":
          metricValue = formatNumber(conversions);
          change = percentChange(conversions, previous?.conversions ?? 0);
          break;
        case "ctr":
          metricValue = ctr != null ? formatPercent(ctr) : unavailableValue();
          change = null;
          break;
      }
    }

    const status = !channel.connected
      ? "disconnected"
      : channel.hasError
        ? "error"
        : spend > 0
          ? "healthy"
          : "warning";

    return {
      key: channel.key,
      label: channel.label,
      provider: channel.label,
      connected: channel.connected,
      metricValue,
      change,
      comparisonLabel,
      status,
      relativePerformance: channel.connected ? (spend / maxSpend) * 100 : 0,
      href: channel.href,
      connectHref: channel.connectHref,
    };
  });
}

export function buildOrganicChannelPerformanceRows(
  channels: OrganicChannelPerformance[],
  previousChannels: OrganicChannelPerformance[] | undefined,
  metric: OrganicChannelPerformanceMetric,
  comparisonLabel?: string,
): CommandCentreChannelRow[] {
  const maxReach = Math.max(...channels.map((item) => item.reach ?? 0), 1);

  return channels.map((channel) => {
    const previous = previousChannels?.find((item) => item.provider === channel.provider);
    let metricValue = unavailableValue();
    let change: number | null = null;

    if (channel.connected) {
      switch (metric) {
        case "reach":
          metricValue =
            channel.reach != null ? formatNumber(channel.reach) : unavailableValue();
          change = percentChange(channel.reach ?? 0, previous?.reach ?? 0);
          break;
        case "engagement":
          metricValue =
            channel.engagement != null ? formatNumber(channel.engagement) : unavailableValue();
          change = percentChange(channel.engagement ?? 0, previous?.engagement ?? 0);
          break;
        case "engagementRate":
          metricValue =
            channel.engagementRate != null
              ? formatPercent(channel.engagementRate)
              : unavailableValue();
          change = percentChange(
            channel.engagementRate ?? 0,
            previous?.engagementRate ?? 0,
          );
          break;
        case "followersGained":
          metricValue =
            channel.followerGrowth != null
              ? formatNumber(channel.followerGrowth)
              : unavailableValue();
          change = percentChange(channel.followerGrowth ?? 0, previous?.followerGrowth ?? 0);
          break;
      }
    }

    const status = !channel.connected
      ? "disconnected"
      : channel.unavailableMetrics.length > 0 && channel.reach == null
        ? "warning"
        : "healthy";

    return {
      key: channel.provider,
      label: channel.channel,
      provider: channel.provider,
      connected: channel.connected,
      metricValue,
      change,
      comparisonLabel,
      status,
      relativePerformance:
        channel.connected && channel.reach != null ? ((channel.reach ?? 0) / maxReach) * 100 : 0,
      href: "/organic-social/growth",
      connectHref: "/organic-social/accounts",
      actionLabel: "View organic performance",
    };
  });
}

export function buildFunnelStages(input: {
  impressions: number | null;
  clicks: number | null;
  visits: number | null;
  conversions: number | null;
  revenue: number | null;
}): CommandCentreFunnelStage[] {
  const stages: CommandCentreFunnelStage[] = [];

  if (input.impressions != null && input.impressions > 0) {
    stages.push({
      stage: "Impressions",
      count: input.impressions,
      availability: "available",
    });
  } else if (input.impressions === 0) {
    stages.push({ stage: "Impressions", count: 0, availability: "zero" });
  }

  if (input.clicks != null && input.clicks > 0) {
    const ctr =
      input.impressions && input.impressions > 0
        ? formatPercent((input.clicks / input.impressions) * 100)
        : undefined;
    stages.push({
      stage: "Clicks",
      count: input.clicks,
      rateLabel: ctr ? "CTR" : undefined,
      rateValue: ctr,
      availability: "available",
    });
  } else if (input.clicks === 0) {
    stages.push({ stage: "Clicks", count: 0, availability: "zero" });
  }

  if (input.visits != null && input.visits > 0) {
    const rate =
      input.clicks && input.clicks > 0
        ? formatPercent((input.visits / input.clicks) * 100)
        : undefined;
    stages.push({
      stage: "Landing page views",
      count: input.visits,
      rateLabel: rate ? "Visit rate" : undefined,
      rateValue: rate,
      availability: "available",
    });
  } else if (input.visits === 0) {
    stages.push({ stage: "Landing page views", count: 0, availability: "zero" });
  }

  if (input.conversions != null && input.conversions > 0) {
    const cvr =
      input.clicks && input.clicks > 0
        ? formatPercent((input.conversions / input.clicks) * 100)
        : undefined;
    stages.push({
      stage: "Conversions",
      count: input.conversions,
      rateLabel: cvr ? "CVR" : undefined,
      rateValue: cvr,
      availability: "available",
    });
  } else if (input.conversions === 0) {
    stages.push({ stage: "Conversions", count: 0, availability: "zero" });
  }

  if (input.revenue != null && input.revenue > 0) {
    stages.push({
      stage: "Revenue",
      count: Math.round(input.revenue),
      rateValue: formatCurrency(input.revenue),
      availability: "available",
    });
  } else if (input.revenue === 0) {
    stages.push({ stage: "Revenue", count: 0, availability: "zero" });
  }

  return stages;
}

export function extractSparkline(points: Array<{ value: number }>, maxPoints = 8): number[] {
  if (points.length === 0) {
    return [];
  }
  if (points.length <= maxPoints) {
    return points.map((point) => point.value);
  }
  const step = Math.ceil(points.length / maxPoints);
  return points.filter((_, index) => index % step === 0).map((point) => point.value);
}
