import type { ChannelPerformanceMetric, CommandCentreChannelRow } from "@/lib/command-centre/types";
import type { PaidProviderMetrics } from "@/lib/marketing-intelligence/types";
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

export function buildFunnelStages(input: {
  impressions: number | null;
  clicks: number | null;
  visits: number | null;
  conversions: number | null;
  revenue: number | null;
}) {
  const stages = [];

  if (input.impressions != null && input.impressions > 0) {
    stages.push({ stage: "Impressions", count: input.impressions });
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
    });
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
    });
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
    });
  }

  if (input.revenue != null && input.revenue > 0) {
    stages.push({
      stage: "Revenue",
      count: Math.round(input.revenue),
      rateValue: formatCurrency(input.revenue),
    });
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
