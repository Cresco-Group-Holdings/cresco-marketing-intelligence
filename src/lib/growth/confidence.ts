import type { GrowthConfidenceLevel } from "@prisma/client";
import { MIN_BRAND_POSTS, MIN_SEGMENT_POSTS } from "@/lib/growth/constants";

export type ConfidenceInput = {
  sampleSize: number;
  segmentSampleSize?: number;
  hasComparisonPeriod: boolean;
  liftMagnitude?: number;
};

/** Deterministic confidence scoring — never inferred by AI. */
export function computeConfidence(input: ConfidenceInput): GrowthConfidenceLevel {
  const { sampleSize, segmentSampleSize, hasComparisonPeriod, liftMagnitude } = input;

  if (sampleSize < MIN_BRAND_POSTS) return "LOW";
  if (segmentSampleSize !== undefined && segmentSampleSize < MIN_SEGMENT_POSTS) return "LOW";

  const strongLift = liftMagnitude !== undefined && Math.abs(liftMagnitude - 1) >= 0.5;
  const moderateLift = liftMagnitude !== undefined && Math.abs(liftMagnitude - 1) >= 0.25;

  if (sampleSize >= MIN_BRAND_POSTS * 2 && hasComparisonPeriod && strongLift) return "HIGH";
  if (sampleSize >= MIN_BRAND_POSTS && hasComparisonPeriod && moderateLift) return "MEDIUM";
  if (sampleSize >= MIN_BRAND_POSTS && hasComparisonPeriod) return "MEDIUM";
  return "LOW";
}
