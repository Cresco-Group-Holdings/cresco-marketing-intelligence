import type { SeoKeywordMetricType, SeoKeywordSourceType } from "@prisma/client";

export type MetricValue = {
  metricType: SeoKeywordMetricType;
  provider: string;
  source: SeoKeywordSourceType;
  value?: number | null;
  stringValue?: string | null;
  location?: string;
  language?: string;
  measuredAt: Date;
  periodStart?: Date;
  periodEnd?: Date;
  confidence?: number;
  freshness?: string;
  providerDefinition?: string;
};

/** Null must not be displayed as zero. */
export function formatMetricDisplay(metric: MetricValue): string | null {
  if (metric.stringValue != null) return metric.stringValue;
  if (metric.value == null) return null;

  switch (metric.metricType) {
    case "CTR":
      return `${(metric.value * 100).toFixed(1)}%`;
    case "AVERAGE_POSITION":
    case "RANK_POSITION":
      return metric.value.toFixed(1);
    case "CPC":
      return `$${metric.value.toFixed(2)}`;
    default:
      return metric.value.toLocaleString();
  }
}

export function isMetricStale(measuredAt: Date, maxAgeDays = 30): boolean {
  const ageMs = Date.now() - measuredAt.getTime();
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
}

export function gscMetricsFromRow(row: {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  date: string;
}): MetricValue[] {
  const measuredAt = new Date(row.date);
  const base = { provider: "GOOGLE_SEARCH_CONSOLE", source: "SEARCH_CONSOLE" as const, measuredAt };
  return [
    { ...base, metricType: "CLICKS", value: row.clicks },
    { ...base, metricType: "IMPRESSIONS", value: row.impressions },
    { ...base, metricType: "CTR", value: row.ctr },
    { ...base, metricType: "AVERAGE_POSITION", value: row.position },
  ];
}
