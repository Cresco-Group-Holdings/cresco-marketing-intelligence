import type { PatternDimension } from "@/lib/growth/constants";
import { CORRELATION_DISCLAIMER, MIN_SEGMENT_POSTS } from "@/lib/growth/constants";
import {
  type PostSnapshot,
  collectMetricValues,
  median,
} from "@/lib/growth/baselines";

export type PatternResult = {
  dimension: PatternDimension;
  dimensionValue: string;
  metricKey: string;
  metricValue: number;
  sampleSize: number;
  supportingContentIds: string[];
  correlationNote: string;
};

function extractDimensionValue(
  post: PostSnapshot,
  dimension: PatternDimension,
): string | null {
  const attr = post.attribution;
  switch (dimension) {
    case "contentPillar":
      return attr?.contentPillar ?? null;
    case "hookType":
      return attr?.hook ? attr.hook.slice(0, 80) : null;
    case "topic":
      return attr?.contentPillar ?? attr?.campaignName ?? null;
    case "format":
      return attr?.contentType ?? null;
    case "duration": {
      const seconds = attr?.durationSeconds;
      if (seconds === null || seconds === undefined) return null;
      if (seconds < 30) return "short";
      if (seconds < 90) return "medium";
      return "long";
    }
    case "captionLength": {
      const len = attr?.captionLength;
      if (len === null || len === undefined) return null;
      if (len < 100) return "short";
      if (len < 300) return "medium";
      return "long";
    }
    case "cta":
      return attr?.primaryCTA ?? null;
    case "hashtagGroup": {
      const count = attr?.hashtags?.length ?? 0;
      if (count === 0) return "none";
      if (count <= 3) return "few";
      if (count <= 10) return "moderate";
      return "many";
    }
    case "day":
      return post.publishedAt
        ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][post.publishedAt.getUTCDay()]!
        : null;
    case "hour":
      return post.publishedAt ? String(post.publishedAt.getUTCHours()) : null;
    case "platform":
      return post.provider;
    case "audience":
      return attr?.targetAudienceId ?? null;
    case "offer":
      return attr?.campaignName ?? null;
    default:
      return null;
  }
}

export function analyzeContentPatterns(posts: PostSnapshot[]): PatternResult[] {
  const results: PatternResult[] = [];
  const dimensions: PatternDimension[] = [
    "contentPillar",
    "hookType",
    "format",
    "duration",
    "captionLength",
    "cta",
    "hashtagGroup",
    "day",
    "hour",
    "platform",
    "audience",
    "offer",
  ];

  for (const dimension of dimensions) {
    const buckets = new Map<string, PostSnapshot[]>();
    for (const post of posts) {
      const value = extractDimensionValue(post, dimension);
      if (!value) continue;
      const bucket = buckets.get(value) ?? [];
      bucket.push(post);
      buckets.set(value, bucket);
    }

    for (const [dimensionValue, bucket] of buckets) {
      if (bucket.length < MIN_SEGMENT_POSTS) continue;
      const values = collectMetricValues(bucket, "engagementRate");
      const med = median(values);
      if (med === null) continue;

      results.push({
        dimension,
        dimensionValue,
        metricKey: "engagementRate",
        metricValue: med,
        sampleSize: bucket.length,
        supportingContentIds: [
          ...new Set(
            bucket.map((p) => p.contentItemId).filter((id): id is string => Boolean(id)),
          ),
        ],
        correlationNote: CORRELATION_DISCLAIMER,
      });
    }
  }

  return results;
}
