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
  metadata?: Record<string, unknown>;
};

function extractDimensionValue(
  post: PostSnapshot,
  dimension: PatternDimension,
): { value: string | null; source?: string } {
  const attr = post.attribution;
  switch (dimension) {
    case "contentPillar":
      return { value: attr?.contentPillar ?? null };
    case "hookType":
      return { value: attr?.hook ? attr.hook.slice(0, 80) : null };
    case "topic":
      if (attr?.topic) {
        return { value: attr.topic, source: attr.topicSource ?? "provenance" };
      }
      return { value: null };
    case "format":
      return { value: attr?.contentType ?? null };
    case "duration": {
      const seconds = attr?.durationSeconds;
      if (seconds === null || seconds === undefined) return { value: null };
      if (seconds < 30) return { value: "short" };
      if (seconds < 90) return { value: "medium" };
      return { value: "long" };
    }
    case "captionLength": {
      const len = attr?.captionLength;
      if (len === null || len === undefined) return { value: null };
      if (len < 100) return { value: "short" };
      if (len < 300) return { value: "medium" };
      return { value: "long" };
    }
    case "cta":
      return { value: attr?.primaryCTA ?? null };
    case "hashtagGroup": {
      const count = attr?.hashtags?.length ?? 0;
      if (count === 0) return { value: "none" };
      if (count <= 3) return { value: "few" };
      if (count <= 10) return { value: "moderate" };
      return { value: "many" };
    }
    case "day":
      return {
        value: post.publishedAt
          ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][post.publishedAt.getUTCDay()]!
          : null,
      };
    case "hour":
      return { value: post.publishedAt ? String(post.publishedAt.getUTCHours()) : null };
    case "platform":
      return { value: post.provider };
    case "audience":
      return { value: attr?.targetAudienceId ?? null };
    case "offer":
      if (attr?.offerName) {
        return { value: attr.offerName, source: attr.offerSource ?? "provenance" };
      }
      return { value: null };
    case "campaign":
      return { value: attr?.campaignName ?? null };
    case "owner":
      return { value: attr?.ownerUserId ?? null };
    default:
      return { value: null };
  }
}

export function analyzeContentPatterns(posts: PostSnapshot[]): PatternResult[] {
  const results: PatternResult[] = [];
  const dimensions: PatternDimension[] = [
    "contentPillar",
    "hookType",
    "topic",
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
    "campaign",
    "owner",
  ];

  for (const dimension of dimensions) {
    const buckets = new Map<string, { posts: PostSnapshot[]; source?: string }>();
    for (const post of posts) {
      const extracted = extractDimensionValue(post, dimension);
      if (!extracted.value) continue;
      const bucket = buckets.get(extracted.value) ?? { posts: [], source: extracted.source };
      bucket.posts.push(post);
      buckets.set(extracted.value, bucket);
    }

    for (const [dimensionValue, bucket] of buckets) {
      if (bucket.posts.length < MIN_SEGMENT_POSTS) continue;
      const values = collectMetricValues(bucket.posts, "engagementRate");
      const med = median(values);
      if (med === null) continue;

      results.push({
        dimension,
        dimensionValue,
        metricKey: "engagementRate",
        metricValue: med,
        sampleSize: bucket.posts.length,
        supportingContentIds: [
          ...new Set(
            bucket.posts.map((p) => p.contentItemId).filter((id): id is string => Boolean(id)),
          ),
        ],
        correlationNote: CORRELATION_DISCLAIMER,
        metadata: bucket.source ? { source: bucket.source } : undefined,
      });
    }
  }

  return results;
}
