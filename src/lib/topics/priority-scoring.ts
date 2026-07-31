import { PRIORITY_FACTOR_WEIGHTS, PRIORITY_SCORE_VERSION } from "@/lib/topics/constants";

export type PriorityFactors = {
  businessRelevance?: number | null;
  impressions?: number | null;
  existingPosition?: number | null;
  conversionRelevance?: number | null;
  contentGap?: number | null;
  competitorCoverage?: number | null;
  pageWeakness?: number | null;
  implementationEffort?: number | null;
  strategicImportance?: number | null;
};

export type PriorityScoreResult = {
  scoreVersion: string;
  totalScore: number | null;
  factors: Record<string, number | null>;
  missingFactors: string[];
  normalisedWeights: Record<string, number>;
};

function normaliseImpressions(value: number): number {
  return Math.min(1, Math.log10(value + 1) / 4);
}

function normalisePosition(value: number): number {
  if (value <= 0) return 0;
  return Math.max(0, Math.min(1, (21 - value) / 20));
}

/** Versioned deterministic score using only available factors — no fabricated defaults. */
export function calculatePriorityScore(input: PriorityFactors): PriorityScoreResult {
  const raw: Record<string, number | null> = {
    businessRelevance: input.businessRelevance ?? null,
    impressions: input.impressions != null ? normaliseImpressions(input.impressions) : null,
    existingPosition: input.existingPosition != null ? normalisePosition(input.existingPosition) : null,
    conversionRelevance: input.conversionRelevance ?? null,
    contentGap: input.contentGap ?? null,
    competitorCoverage: input.competitorCoverage ?? null,
    pageWeakness: input.pageWeakness ?? null,
    implementationEffort: input.implementationEffort != null ? 1 - input.implementationEffort : null,
    strategicImportance: input.strategicImportance ?? null,
  };

  const missingFactors = Object.entries(raw)
    .filter(([, v]) => v === null)
    .map(([k]) => k);

  const available = Object.entries(raw).filter(([, v]) => v !== null) as Array<[string, number]>;
  if (available.length === 0) {
    return {
      scoreVersion: PRIORITY_SCORE_VERSION,
      totalScore: null,
      factors: raw,
      missingFactors,
      normalisedWeights: {},
    };
  }

  const weightSum = available.reduce(
    (sum, [key]) => sum + (PRIORITY_FACTOR_WEIGHTS[key as keyof typeof PRIORITY_FACTOR_WEIGHTS] ?? 0),
    0,
  );

  const normalisedWeights: Record<string, number> = {};
  let totalScore = 0;
  for (const [key, value] of available) {
    const baseWeight = PRIORITY_FACTOR_WEIGHTS[key as keyof typeof PRIORITY_FACTOR_WEIGHTS] ?? 0;
    const weight = weightSum > 0 ? baseWeight / weightSum : 0;
    normalisedWeights[key] = weight;
    totalScore += value * weight;
  }

  return {
    scoreVersion: PRIORITY_SCORE_VERSION,
    totalScore: Math.round(totalScore * 1000) / 1000,
    factors: raw,
    missingFactors,
    normalisedWeights,
  };
}
