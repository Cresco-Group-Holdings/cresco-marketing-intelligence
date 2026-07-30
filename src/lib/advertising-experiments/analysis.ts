import { ANALYSIS_DISCLAIMER, MIN_PERCENTAGE_DIFFERENCE } from "./constants";
import type { ValidityCheck } from "./validity";

export type VariantMetricValue = {
  variantId: string;
  label: string;
  metricKey: string;
  absoluteValue: number;
  sampleSize: number;
};

export type AnalysisResult = {
  absoluteDifference: number | null;
  relativeDifference: number | null;
  sampleSizes: Record<string, number>;
  testDurationDays: number | null;
  confidenceMethod: string | null;
  uncertaintyLower: number | null;
  uncertaintyUpper: number | null;
  observedResult: string;
  validityWarnings: string[];
  recommendation: string;
  significanceClaimed: boolean;
};

function normalApproximationInterval(value: number, sampleSize: number): { lower: number; upper: number } | null {
  if (sampleSize < 30) return null;
  const se = Math.sqrt((value * (1 - Math.min(value, 0.999))) / sampleSize);
  return { lower: value - 1.96 * se, upper: value + 1.96 * se };
}

export function analyzeExperiment(input: {
  primaryMetricKey: string;
  variantValues: VariantMetricValue[];
  validityChecks: ValidityCheck[];
  testDurationDays: number;
  minimumVolume: number;
  decisionRule: string;
}): AnalysisResult {
  const validityWarnings = input.validityChecks
    .filter((c) => c.severity !== "INFO")
    .map((c) => c.message);

  const primary = input.variantValues.filter((v) => v.metricKey === input.primaryMetricKey);
  const sampleSizes = Object.fromEntries(primary.map((v) => [v.variantId, v.sampleSize]));

  if (primary.length < 2) {
    return {
      absoluteDifference: null,
      relativeDifference: null,
      sampleSizes,
      testDurationDays: input.testDurationDays,
      confidenceMethod: null,
      uncertaintyLower: null,
      uncertaintyUpper: null,
      observedResult: "Insufficient variant data for comparison.",
      validityWarnings,
      recommendation: "CONTINUE_TEST",
      significanceClaimed: false,
    };
  }

  const insufficient = primary.some((v) => v.sampleSize < input.minimumVolume);
  const hasCritical = input.validityChecks.some((c) => c.severity === "CRITICAL");

  if (insufficient || hasCritical) {
    return {
      absoluteDifference: null,
      relativeDifference: null,
      sampleSizes,
      testDurationDays: input.testDurationDays,
      confidenceMethod: null,
      uncertaintyLower: null,
      uncertaintyUpper: null,
      observedResult: hasCritical ? "Test invalid due to critical validity issues." : "Insufficient volume.",
      validityWarnings,
      recommendation: hasCritical ? "INVALID_TEST" : "CONTINUE_TEST",
      significanceClaimed: false,
    };
  }

  const sorted = [...primary].sort((a, b) => b.absoluteValue - a.absoluteValue);
  const best = sorted[0];
  const control = sorted[sorted.length - 1];
  const absoluteDifference = best.absoluteValue - control.absoluteValue;
  const relativeDifference =
    control.absoluteValue !== 0 ? (absoluteDifference / Math.abs(control.absoluteValue)) * 100 : null;

  const interval = normalApproximationInterval(best.absoluteValue, best.sampleSize);
  const confidenceMethod = interval ? "normal_approximation_95" : null;

  let recommendation = "INCONCLUSIVE";
  if (relativeDifference !== null && Math.abs(relativeDifference) >= MIN_PERCENTAGE_DIFFERENCE) {
    recommendation = "ADOPT_VARIANT";
  }

  return {
    absoluteDifference,
    relativeDifference,
    sampleSizes,
    testDurationDays: input.testDurationDays,
    confidenceMethod,
    uncertaintyLower: interval?.lower ?? null,
    uncertaintyUpper: interval?.upper ?? null,
    observedResult: `Best variant "${best.label}" vs control "${control.label}": ${relativeDifference?.toFixed(1) ?? "N/A"}% relative difference.`,
    validityWarnings,
    recommendation,
    significanceClaimed: confidenceMethod !== null && !hasCritical,
  };
}

export function formatAnalysisDisclaimer(significanceClaimed: boolean): string {
  if (!significanceClaimed) return "No statistical significance claimed — validity prerequisites not met.";
  return ANALYSIS_DISCLAIMER;
}
