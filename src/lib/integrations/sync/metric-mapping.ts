export const PROVIDER_METRIC_TO_CANONICAL: Record<string, string> = {
  impressions: "impressions",
  clicks: "clicks",
  spend: "spend",
  cost: "spend",
  cost_micros: "spend",
  reach: "reach",
  engagements: "engagement",
  engagement: "engagement",
  conversions: "conversions",
  leads: "leads",
  revenue: "revenue",
  sessions: "sessions",
  ctr: "ctr",
  cpc: "cpc",
  cpm: "cpm",
};

export function mapProviderMetricKey(providerMetric: string): string | null {
  const normalised = providerMetric.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return PROVIDER_METRIC_TO_CANONICAL[normalised] ?? null;
}

export function mapProviderMetrics(
  metrics: Record<string, number>,
): { mapped: Record<string, number>; unsupported: string[] } {
  const mapped: Record<string, number> = {};
  const unsupported: string[] = [];

  for (const [key, value] of Object.entries(metrics)) {
    const canonical = mapProviderMetricKey(key);
    if (canonical) {
      mapped[canonical] = value;
    } else {
      unsupported.push(key);
    }
  }

  return { mapped, unsupported };
}
