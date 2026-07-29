import type { GrowthInsightType } from "@prisma/client";

/** Stable key for a brand analysis window. */
export function analysisRunIdempotencyKey(
  brandId: string,
  periodStart: Date,
  periodEnd: Date,
): string {
  return `${brandId}:${periodStart.toISOString()}:${periodEnd.toISOString()}`;
}

/** Stable key for one insight slot within an analysis window. */
export function insightIdempotencyKey(
  brandId: string,
  periodStart: Date,
  periodEnd: Date,
  insightType: GrowthInsightType,
): string {
  return `${analysisRunIdempotencyKey(brandId, periodStart, periodEnd)}:${insightType}`;
}

/** Stable key for a recommendation tied to an insight type and window. */
export function recommendationIdempotencyKey(
  brandId: string,
  periodStart: Date,
  periodEnd: Date,
  insightType: GrowthInsightType,
): string {
  return `${insightIdempotencyKey(brandId, periodStart, periodEnd, insightType)}:recommendation`;
}
