import type {
  ContentPerformanceClass,
  ThemePerformanceRow,
} from "@/lib/content-intelligence/types";
import { resolveThemeLabel } from "@/lib/content-intelligence/themes";
import { unavailableValue } from "@/lib/marketing-intelligence/format";

export type ContentPerformanceInput = {
  id: string;
  title: string;
  contentPillar: string | null;
  channel: string | null;
  reach: number | null;
  engagement: number | null;
  clicks: number | null;
  engagementRate: number | null;
  publishedAt: string | null;
};

export function classifyContentPerformance(
  engagementRate: number | null,
  baselineRate: number | null,
  sampleSize: number,
): ContentPerformanceClass {
  if (engagementRate === null || baselineRate === null || sampleSize < 3) {
    return "insufficient_data";
  }
  const ratio = baselineRate > 0 ? engagementRate / baselineRate : 0;
  if (ratio >= 1.5) return "winning";
  if (ratio >= 1.15) return "strong";
  if (ratio >= 0.85) return "typical";
  return "weak";
}

export function aggregateThemePerformance(
  items: ContentPerformanceInput[],
): ThemePerformanceRow[] {
  const byTheme = new Map<
    string,
    { reach: number; engagement: number; clicks: number; posts: number; rates: number[] }
  >();

  for (const item of items) {
    const theme = item.contentPillar ?? "unassigned";
    const bucket = byTheme.get(theme) ?? {
      reach: 0,
      engagement: 0,
      clicks: 0,
      posts: 0,
      rates: [],
    };
    if (item.reach !== null) bucket.reach += item.reach;
    if (item.engagement !== null) bucket.engagement += item.engagement;
    if (item.clicks !== null) bucket.clicks += item.clicks;
    if (item.engagementRate !== null) bucket.rates.push(item.engagementRate);
    bucket.posts += 1;
    byTheme.set(theme, bucket);
  }

  const allRates = items
    .map((i) => i.engagementRate)
    .filter((r): r is number => r !== null);
  const baseline =
    allRates.length > 0 ? allRates.reduce((a, b) => a + b, 0) / allRates.length : null;

  return Array.from(byTheme.entries())
    .map(([theme, stats]) => {
      const avgRate =
        stats.rates.length > 0
          ? stats.rates.reduce((a, b) => a + b, 0) / stats.rates.length
          : null;
      return {
        theme,
        label: resolveThemeLabel(theme === "unassigned" ? null : theme),
        reach: stats.reach > 0 ? stats.reach : null,
        engagement: stats.engagement > 0 ? stats.engagement : null,
        clicks: stats.clicks > 0 ? stats.clicks : null,
        posts: stats.posts,
        classification: classifyContentPerformance(avgRate, baseline, stats.posts),
      };
    })
    .sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0));
}

export function formatMetricValue(value: number | null, type: "count" | "percent" = "count"): string {
  if (value === null) return unavailableValue();
  if (type === "percent") return `${value.toFixed(1)}%`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}
