import type { FunnelInsight, FunnelStepMetrics } from "@/lib/funnel/types";

const SLOW_TRANSITION_THRESHOLD_MS = 7 * 86_400_000;

export function generateFunnelInsights(stepResults: FunnelStepMetrics[]): FunnelInsight[] {
  const insights: FunnelInsight[] = [];

  if (stepResults.length === 0) return insights;

  const largestDropOff = [...stepResults]
    .filter((s) => s.stepOrder > 1)
    .sort((a, b) => b.dropOffRate - a.dropOffRate)[0];

  if (largestDropOff && largestDropOff.dropOffRate > 0) {
    insights.push({
      insightType: "LARGEST_DROP_OFF",
      stepOrder: largestDropOff.stepOrder,
      stepName: largestDropOff.stepName,
      metricValue: largestDropOff.dropOffRate,
      evidence: {
        dropOffCount: largestDropOff.dropOffCount,
        entrants: largestDropOff.entrants,
        dropOffRate: largestDropOff.dropOffRate,
      },
      message: `Largest drop-off observed at step "${largestDropOff.stepName}" (${largestDropOff.dropOffRate.toFixed(1)}% of entrants did not complete).`,
      severity: largestDropOff.dropOffRate > 50 ? "warning" : "info",
    });
  }

  const slowStep = stepResults.find(
    (s) => s.medianTimeToNextMs != null && s.medianTimeToNextMs > SLOW_TRANSITION_THRESHOLD_MS,
  );
  if (slowStep) {
    const days = Math.round((slowStep.medianTimeToNextMs ?? 0) / 86_400_000);
    insights.push({
      insightType: "SLOW_TRANSITION",
      stepOrder: slowStep.stepOrder,
      stepName: slowStep.stepName,
      metricValue: slowStep.medianTimeToNextMs ?? undefined,
      evidence: { medianTimeToNextMs: slowStep.medianTimeToNextMs, thresholdMs: SLOW_TRANSITION_THRESHOLD_MS },
      message: `Median time to complete "${slowStep.stepName}" is ${days} days — above the 7-day threshold.`,
      severity: "info",
    });
  }

  for (let i = 1; i < stepResults.length; i++) {
    const prev = stepResults[i - 1]!;
    const curr = stepResults[i]!;
    if (prev.stepConversion > 0 && curr.stepConversion < prev.stepConversion * 0.5) {
      insights.push({
        insightType: "WORSENING_CONVERSION",
        stepOrder: curr.stepOrder,
        stepName: curr.stepName,
        metricValue: curr.stepConversion,
        evidence: {
          previousStepConversion: prev.stepConversion,
          currentStepConversion: curr.stepConversion,
        },
        message: `Step conversion at "${curr.stepName}" (${curr.stepConversion.toFixed(1)}%) is significantly lower than the previous step (${prev.stepConversion.toFixed(1)}%).`,
        severity: "warning",
      });
    }
  }

  const signupStart = stepResults.find((s) => /signup.*start/i.test(s.stepName));
  const signupComplete = stepResults.find((s) => /signup.*complete/i.test(s.stepName));
  if (signupStart && signupComplete && signupStart.completions > 10 && signupComplete.stepConversion < 30) {
    insights.push({
      insightType: "HIGH_SIGNUP_LOW_COMPLETION",
      stepOrder: signupComplete.stepOrder,
      stepName: signupComplete.stepName,
      metricValue: signupComplete.stepConversion,
      evidence: {
        signupStarts: signupStart.completions,
        signupCompletions: signupComplete.completions,
        completionRate: signupComplete.stepConversion,
      },
      message: `High signup starts (${signupStart.completions}) but low completion rate (${signupComplete.stepConversion.toFixed(1)}%) — investigate form friction.`,
      severity: "warning",
    });
  }

  return insights;
}

export function generateSegmentInsights(
  segments: Array<{ dimension: string; segmentValue: string; entrants: number; conversionRate: number }>,
): FunnelInsight[] {
  const insights: FunnelInsight[] = [];

  const highTraffic = segments.filter((s) => s.entrants > 20).sort((a, b) => b.entrants - a.entrants);
  const lowActivation = segments.filter((s) => s.conversionRate < 5 && s.entrants > 10);

  for (const segment of highTraffic.slice(0, 3)) {
    const activation = segments.find(
      (s) => s.dimension === segment.dimension && s.segmentValue === segment.segmentValue,
    );
    if (activation && activation.conversionRate < 10) {
      insights.push({
        insightType: "STRONG_TRAFFIC_WEAK_ACTIVATION",
        segmentDimension: segment.dimension,
        segmentValue: segment.segmentValue,
        metricValue: activation.conversionRate,
        evidence: { entrants: segment.entrants, conversionRate: activation.conversionRate },
        message: `${segment.dimension} "${segment.segmentValue}" has strong traffic (${segment.entrants} entrants) but weak activation (${activation.conversionRate.toFixed(1)}%).`,
        severity: "info",
      });
    }
  }

  for (const segment of lowActivation.slice(0, 2)) {
    insights.push({
      insightType: "LOW_QUALITY_CONVERSIONS",
      segmentDimension: segment.dimension,
      segmentValue: segment.segmentValue,
      metricValue: segment.conversionRate,
      evidence: { entrants: segment.entrants, conversionRate: segment.conversionRate },
      message: `${segment.dimension} "${segment.segmentValue}" shows low conversion rate (${segment.conversionRate.toFixed(1)}%) relative to ${segment.entrants} entrants.`,
      severity: "info",
    });
  }

  return insights;
}
