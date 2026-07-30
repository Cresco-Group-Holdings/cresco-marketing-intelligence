export const PAID_ADS_METRIC_MAP: Record<string, string> = {
  spend: "cost",
  cost: "cost",
  cost_micros: "cost",
  impressions: "impressions",
  reach: "reach",
  frequency: "frequency",
  clicks: "clicks",
  link_clicks: "link_clicks",
  inline_link_clicks: "link_clicks",
  ctr: "ctr",
  cpc: "cpc",
  cpm: "cpm",
  video_views: "video_views",
  video_view: "video_views",
  conversions: "conversions",
  conversion_value: "conversion_value",
  cost_per_conversion: "cost_per_conversion",
  roas: "roas",
  purchase_roas: "roas",
};

export const PAID_ADS_RATE_METRICS = new Set([
  "ctr",
  "cpc",
  "cpm",
  "frequency",
  "roas",
  "cost_per_conversion",
]);

export function mapPaidAdsMetric(providerMetric: string): string | null {
  const normalised = providerMetric.trim().toLowerCase();
  return PAID_ADS_METRIC_MAP[normalised] ?? null;
}
