import { describe, expect, it } from "vitest";
import {
  buildAllowedNumericCatalog,
  validateGrowthAiExplanation,
} from "@/lib/growth/ai-validation";
import { growthInsightExplanationSchema } from "@/lib/ai/growth-output-schemas";
import { AppError } from "@/lib/errors";

const baseExplanation = {
  finding: "Education pillar posts outperform the brand median.",
  explanation: "The supplied engagement evidence shows stronger performance in Education content.",
  recommendedAction: "Create another Education post.",
  evidence: [{ evidenceKey: "engagementRate", evidenceLabel: "Pillar: Education", value: 4.2 }],
  expectedHypothesis: "More Education posts will sustain above-median engagement.",
  measurementPlan: "Compare the next three Education posts to the brand median.",
};

describe("growth AI validation", () => {
  it("accepts structured explanation with evidence references", () => {
    const parsed = growthInsightExplanationSchema.parse(baseExplanation);
    expect(parsed.evidence).toHaveLength(1);
  });

  it("permits only whitelisted numerics from evidence", () => {
    const allowedNumerics = buildAllowedNumericCatalog({
      sourceMetrics: { brandMedianEngagementRate: 2.1, segmentEngagementRate: 4.2 },
      evidence: [{ evidenceKey: "engagementRate", evidenceValue: { value: 4.2, benchmark: 2.1 } }],
    });

    expect(() =>
      validateGrowthAiExplanation(baseExplanation, {
        allowedEvidenceKeys: new Set(["engagementRate"]),
        allowedNumerics,
        allowedLabels: new Set(["Education", "HIGH_PERFORMING_TOPIC"]),
      }),
    ).not.toThrow();
  });

  it("rejects unsupported evidence keys and invented statistics", () => {
    const allowedNumerics = buildAllowedNumericCatalog({
      sourceMetrics: { brandMedianEngagementRate: 2.1 },
      evidence: [{ evidenceKey: "engagementRate", evidenceValue: { value: 2.1 } }],
    });

    expect(() =>
      validateGrowthAiExplanation(
        {
          ...baseExplanation,
          evidence: [{ evidenceKey: "madeUp", value: 1 }],
        },
        {
          allowedEvidenceKeys: new Set(["engagementRate"]),
          allowedNumerics,
          allowedLabels: new Set(),
        },
      ),
    ).toThrow(AppError);

    expect(() =>
      validateGrowthAiExplanation(
        {
          ...baseExplanation,
          explanation: "This post achieved 99.9% engagement, far above expectations.",
        },
        {
          allowedEvidenceKeys: new Set(["engagementRate"]),
          allowedNumerics,
          allowedLabels: new Set(),
        },
      ),
    ).toThrow(AppError);
  });
});
