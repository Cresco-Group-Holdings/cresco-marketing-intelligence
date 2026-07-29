import type { SocialExperimentTestType } from "@prisma/client";

export const OBSERVATIONAL_DISCLAIMER =
  "Observational comparison only. This is not a randomised controlled trial and platforms do not deliver content to equivalent audiences.";

export const EXPERIMENT_TEST_TYPE_LABELS: Record<SocialExperimentTestType, string> = {
  HOOK: "Hook",
  CAPTION: "Caption",
  CTA: "Call to action",
  VISUAL: "Visual",
  VIDEO_DURATION: "Video duration",
  COVER: "Cover",
  CONTENT_FORMAT: "Content format",
  PUBLISHING_TIME: "Publishing time",
  CONTENT_PILLAR: "Content pillar",
};

export const SUPPORTED_METRIC_KEYS = [
  "impressions",
  "reach",
  "engagement_rate",
  "likes",
  "comments",
  "shares",
  "saves",
  "clicks",
  "video_views",
  "watch_time_seconds",
] as const;

export type ExperimentMetricKey = (typeof SUPPORTED_METRIC_KEYS)[number];

/** Minimum relative difference (10%) before declaring a winner. */
export const WINNER_MIN_PERCENTAGE_DIFFERENCE = 10;

/** Audience size imbalance threshold (2x difference). */
export const AUDIENCE_IMBALANCE_RATIO = 2;

/** Publishing time comparability window in hours. */
export const PUBLISH_TIME_COMPARABILITY_HOURS = 4;

export const VALIDITY_WARNING_CODES = {
  DIFFERENT_PLATFORMS: "DIFFERENT_PLATFORMS",
  AUDIENCE_SIZE_IMBALANCE: "AUDIENCE_SIZE_IMBALANCE",
  INCOMPARABLE_PUBLISH_TIMES: "INCOMPARABLE_PUBLISH_TIMES",
  PAID_PROMOTION_BIAS: "PAID_PROMOTION_BIAS",
  INSUFFICIENT_SAMPLE: "INSUFFICIENT_SAMPLE",
  UNSTABLE_ORGANIC_REACH: "UNSTABLE_ORGANIC_REACH",
  TOPIC_MISMATCH: "TOPIC_MISMATCH",
  NOT_RANDOMISED_AB: "NOT_RANDOMISED_AB",
} as const;

export type ValidityWarningCode =
  (typeof VALIDITY_WARNING_CODES)[keyof typeof VALIDITY_WARNING_CODES];

export type ValidityWarning = {
  code: ValidityWarningCode;
  message: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
};
