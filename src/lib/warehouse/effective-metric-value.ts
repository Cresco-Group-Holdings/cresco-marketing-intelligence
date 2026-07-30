import type { MarketingMetricCorrection, MarketingMetricObservation } from "@prisma/client";
import { Prisma } from "@prisma/client";

export type EffectiveMetricValue = {
  value: Prisma.Decimal;
  source: "observation" | "correction";
  correctionId?: string;
};

/**
 * Resolves the effective metric value for an observation, applying the latest correction when present.
 */
export function resolveEffectiveMetricValue(
  observation: Pick<MarketingMetricObservation, "id" | "metricValue">,
  corrections: Pick<MarketingMetricCorrection, "id" | "marketingMetricObservationId" | "correctedValue" | "appliedAt">[],
): EffectiveMetricValue {
  const latest = corrections
    .filter((correction) => correction.marketingMetricObservationId === observation.id)
    .sort((left, right) => right.appliedAt.getTime() - left.appliedAt.getTime())[0];

  if (latest) {
    return {
      value: latest.correctedValue,
      source: "correction",
      correctionId: latest.id,
    };
  }

  return {
    value: observation.metricValue,
    source: "observation",
  };
}

export function buildCorrectionIndex(
  corrections: Pick<MarketingMetricCorrection, "id" | "marketingMetricObservationId" | "correctedValue" | "appliedAt">[],
) {
  const byObservation = new Map<string, EffectiveMetricValue>();

  for (const observationId of new Set(
    corrections
      .map((correction) => correction.marketingMetricObservationId)
      .filter((value): value is string => Boolean(value)),
  )) {
    const latest = corrections
      .filter((correction) => correction.marketingMetricObservationId === observationId)
      .sort((left, right) => right.appliedAt.getTime() - left.appliedAt.getTime())[0];
    if (latest) {
      byObservation.set(observationId, {
        value: latest.correctedValue,
        source: "correction",
        correctionId: latest.id,
      });
    }
  }

  return byObservation;
}
