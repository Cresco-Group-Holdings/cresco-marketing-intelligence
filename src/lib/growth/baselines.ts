import type { BenchmarkType } from "@prisma/client";
import { clickThroughRate, engagementRate } from "@/lib/social/derived-metrics";

export type PostSnapshot = {
  providerPostId: string;
  provider: string;
  contentItemId: string | null;
  publishedAt: Date | null;
  values: Record<string, number>;
  attribution?: {
    contentPillar?: string | null;
    contentType?: string | null;
    campaignName?: string | null;
    primaryCTA?: string | null;
    targetAudienceId?: string | null;
    hook?: string | null;
    captionLength?: number | null;
    durationSeconds?: number | null;
    hashtags?: string[];
  } | null;
};

export type BenchmarkResult = {
  benchmarkType: BenchmarkType;
  metricKey: string;
  segmentKey: string | null;
  segmentLabel: string | null;
  value: number;
  sampleSize: number;
};

const DERIVED_METRICS = ["engagementRate", "clickThroughRate"] as const;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function deriveMetric(key: string, values: Record<string, number>): number | null {
  if (key === "engagementRate") return engagementRate(values);
  if (key === "clickThroughRate") return clickThroughRate(values);
  return values[key] ?? null;
}

function collectMetricValues(posts: PostSnapshot[], metricKey: string): number[] {
  return posts
    .map((post) => deriveMetric(metricKey, post.values))
    .filter((value): value is number => value !== null && Number.isFinite(value));
}

function benchmark(
  type: BenchmarkType,
  metricKey: string,
  value: number,
  sampleSize: number,
  segmentKey: string | null = null,
  segmentLabel: string | null = null,
): BenchmarkResult {
  return { benchmarkType: type, metricKey, segmentKey, segmentLabel, value, sampleSize };
}

export function computeBaselines(
  currentPosts: PostSnapshot[],
  previousPosts: PostSnapshot[],
): BenchmarkResult[] {
  const results: BenchmarkResult[] = [];
  const metricKeys = [
    "impressions",
    "reach",
    "views",
    "engagementRate",
    "clickThroughRate",
    "likes",
    "comments",
    "shares",
    "clicks",
  ];

  for (const metricKey of metricKeys) {
    const currentValues = collectMetricValues(currentPosts, metricKey);
    const previousValues = collectMetricValues(previousPosts, metricKey);
    const brandMedian = median(currentValues);

    if (brandMedian !== null) {
      results.push(benchmark("BRAND_MEDIAN", metricKey, brandMedian, currentValues.length));
    }

    if (previousValues.length) {
      const prevAvg = previousValues.reduce((sum, v) => sum + v, 0) / previousValues.length;
      results.push(
        benchmark("PREVIOUS_PERIOD", metricKey, prevAvg, previousValues.length),
      );
    }

    if (currentValues.length >= 3) {
      const movingAvg =
        currentValues.reduce((sum, v) => sum + v, 0) / currentValues.length;
      results.push(
        benchmark("MOVING_AVERAGE", metricKey, movingAvg, currentValues.length),
      );
    }
  }

  const byProvider = groupBy(currentPosts, (p) => p.provider);
  for (const [provider, posts] of Object.entries(byProvider)) {
    for (const metricKey of ["engagementRate", "impressions", "reach"]) {
      const values = collectMetricValues(posts, metricKey);
      const med = median(values);
      if (med !== null && values.length >= 3) {
        results.push(
          benchmark(
            "CHANNEL_MEDIAN",
            metricKey,
            med,
            values.length,
            `provider:${provider}`,
            provider,
          ),
        );
      }
    }
  }

  const byContentType = groupBy(
    currentPosts.filter((p) => p.attribution?.contentType),
    (p) => p.attribution!.contentType!,
  );
  for (const [contentType, posts] of Object.entries(byContentType)) {
    const values = collectMetricValues(posts, "engagementRate");
    const med = median(values);
    if (med !== null && values.length >= 3) {
      results.push(
        benchmark(
          "CONTENT_TYPE_MEDIAN",
          "engagementRate",
          med,
          values.length,
          `contentType:${contentType}`,
          contentType,
        ),
      );
    }
  }

  const byCampaign = groupBy(
    currentPosts.filter((p) => p.attribution?.campaignName),
    (p) => p.attribution!.campaignName!,
  );
  for (const [campaign, posts] of Object.entries(byCampaign)) {
    const values = collectMetricValues(posts, "engagementRate");
    const med = median(values);
    if (med !== null && values.length >= 3) {
      results.push(
        benchmark(
          "CAMPAIGN_MEDIAN",
          "engagementRate",
          med,
          values.length,
          `campaign:${campaign}`,
          campaign,
        ),
      );
    }
  }

  return results;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item);
    (acc[key] ??= []).push(item);
    return acc;
  }, {});
}

export function getBenchmarkValue(
  benchmarks: BenchmarkResult[],
  type: BenchmarkType,
  metricKey: string,
  segmentKey?: string | null,
): number | null {
  const match = benchmarks.find(
    (b) =>
      b.benchmarkType === type &&
      b.metricKey === metricKey &&
      (segmentKey === undefined || b.segmentKey === segmentKey),
  );
  return match?.value ?? null;
}

export { DERIVED_METRICS, deriveMetric, median, collectMetricValues };
