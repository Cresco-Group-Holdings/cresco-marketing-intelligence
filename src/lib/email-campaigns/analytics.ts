import { METRIC_LIMITATIONS } from "@/lib/email-campaigns/constants";

export type CampaignMetrics = {
  attempted: number;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  opened: number;
  clicked: number;
  ctaClicks: number;
  conversions: number;
  revenue?: number;
};

export function computeCampaignRates(metrics: CampaignMetrics) {
  const { sent } = metrics;
  if (sent === 0) {
    return { deliveryRate: 0, bounceRate: 0, openRate: 0, clickRate: 0, unsubscribeRate: 0 };
  }
  return {
    deliveryRate: metrics.delivered / sent,
    bounceRate: metrics.bounced / sent,
    openRate: metrics.opened / sent,
    clickRate: metrics.clicked / sent,
    unsubscribeRate: metrics.unsubscribed / sent,
    ctaClickRate: metrics.ctaClicks / sent,
    conversionRate: metrics.conversions / sent,
  };
}

export function buildMetricLimitations(openTrackingEnabled: boolean): Record<string, string> {
  const limitations: Record<string, string> = {};
  if (openTrackingEnabled) limitations.opens = METRIC_LIMITATIONS.opens;
  limitations.clicks = METRIC_LIMITATIONS.clicks;
  limitations.conversions = METRIC_LIMITATIONS.conversions;
  if (limitations.revenue !== undefined) limitations.revenue = METRIC_LIMITATIONS.revenue;
  return limitations;
}
