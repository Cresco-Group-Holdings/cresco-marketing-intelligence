import type { GrowthInsightType } from "@prisma/client";

/** Minimum posts with attribution required before brand-level insights are emitted. */
export const MIN_BRAND_POSTS = 5;

/** Minimum posts in a segment (topic, format, hook) before segment insights are emitted. */
export const MIN_SEGMENT_POSTS = 3;

/** Minimum days in the analysis window for trend comparisons. */
export const MIN_ANALYSIS_DAYS = 14;

/** Default insight relevance window in days. */
export const INSIGHT_EXPIRY_DAYS = 30;

/** Relative lift above median required to flag high performers. */
export const HIGH_PERFORMER_LIFT = 1.25;

/** Relative drop below median required to flag low engagement. */
export const LOW_ENGAGEMENT_DROP = 0.7;

/** Minimum posts per provider before cross-channel comparisons. */
export const MIN_CHANNEL_POSTS = 3;

export const INSUFFICIENT_DATA_MESSAGE = "Not enough data yet";

export const CORRELATION_DISCLAIMER =
  "Patterns reflect correlation with performance, not proven causation.";

export const ALL_INSIGHT_TYPES: GrowthInsightType[] = [
  "HIGH_PERFORMING_TOPIC",
  "HIGH_PERFORMING_FORMAT",
  "LOW_ENGAGEMENT",
  "STRONG_HOOK",
  "WEAK_CTA",
  "POSTING_GAP",
  "BEST_PUBLISHING_WINDOW",
  "AUDIENCE_GROWTH",
  "DECLINING_REACH",
  "VIDEO_RETENTION_DROP",
  "CHANNEL_OPPORTUNITY",
  "REPURPOSING_OPPORTUNITY",
];

export const PATTERN_DIMENSIONS = [
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
] as const;

export type PatternDimension = (typeof PATTERN_DIMENSIONS)[number];
