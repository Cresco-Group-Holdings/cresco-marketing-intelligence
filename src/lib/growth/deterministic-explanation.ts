import type { GrowthInsightType } from "@prisma/client";

type DeterministicExplanationInput = {
  insightType?: GrowthInsightType | null;
  finding: string;
  recommendedAction?: string | null;
  measurementPlan?: string | null;
  expectedHypothesis?: string | null;
  evidence: Array<{ evidenceKey: string; evidenceLabel?: string | null; evidenceValue: unknown }>;
};

export function buildDeterministicExplanation(input: DeterministicExplanationInput) {
  const evidenceSummary = input.evidence.map((item) => ({
    evidenceKey: item.evidenceKey,
    evidenceLabel: item.evidenceLabel ?? undefined,
    value: summariseEvidenceValue(item.evidenceValue),
  }));

  return {
    finding: input.finding,
    explanation:
      "This explanation is generated from deterministic analytics only. " +
      "It references the supplied metrics and evidence without estimating new values.",
    recommendedAction:
      input.recommendedAction ??
      "Review the linked evidence and plan the next content action manually.",
    evidence: evidenceSummary,
    expectedHypothesis:
      input.expectedHypothesis ??
      "Applying the recommended action will move the tracked metric closer to the observed high-performing pattern.",
    measurementPlan:
      input.measurementPlan ??
      "Compare the next three posts in this segment against the brand median for the same metric.",
    explanationSource: "DETERMINISTIC_FALLBACK" as const,
  };
}

function summariseEvidenceValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "object" && value && "value" in (value as Record<string, unknown>)) {
    const inner = (value as Record<string, unknown>).value;
    if (typeof inner === "string" || typeof inner === "number" || typeof inner === "boolean") {
      return inner;
    }
  }
  return null;
}
