import { SUPPORTED_METRICS } from "./constants";

export type MetricDefinition = {
  metricKey: string;
  role: "PRIMARY" | "GUARDRAIL" | "SECONDARY";
  label?: string;
  attributionDefinition?: string;
  providerMetricName?: string;
};

export function validateMetrics(metrics: MetricDefinition[]) {
  const errors: string[] = [];
  const primaries = metrics.filter((m) => m.role === "PRIMARY");

  if (primaries.length !== 1) {
    errors.push("Exactly one PRIMARY metric is required.");
  }

  for (const metric of metrics) {
    if (!(SUPPORTED_METRICS as readonly string[]).includes(metric.metricKey)) {
      errors.push(`Unsupported metric: ${metric.metricKey}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function computeDerivedMetric(metricKey: string, raw: { impressions?: number; clicks?: number; conversions?: number; spend?: number; revenue?: number }) {
  switch (metricKey) {
    case "ctr":
      return raw.impressions && raw.impressions > 0 ? (raw.clicks ?? 0) / raw.impressions : null;
    case "cpc":
      return raw.clicks && raw.clicks > 0 ? (raw.spend ?? 0) / raw.clicks : null;
    case "conversion_rate":
      return raw.clicks && raw.clicks > 0 ? (raw.conversions ?? 0) / raw.clicks : null;
    case "cpa":
      return raw.conversions && raw.conversions > 0 ? (raw.spend ?? 0) / raw.conversions : null;
    case "roas":
      return raw.spend && raw.spend > 0 ? (raw.revenue ?? 0) / raw.spend : null;
    default:
      return null;
  }
}
