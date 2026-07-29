import { describe, expect, it } from "vitest";
import { growthInsightExplanationSchema } from "@/lib/ai/growth-output-schemas";

describe("growth AI output validation", () => {
  it("accepts structured explanation with evidence references", () => {
    const parsed = growthInsightExplanationSchema.parse({
      finding: "Education pillar posts outperform brand median engagement.",
      explanation: "Based on supplied engagement metrics for the Education pillar segment.",
      recommendedAction: "Create another post on this proven topic.",
      evidence: [{ evidenceKey: "engagementRate", evidenceLabel: "Pillar: Education", value: 4.2 }],
      expectedHypothesis: "More Education content will sustain above-median engagement.",
      measurementPlan: "Compare engagement rate of the next 3 Education posts to brand median.",
    });
    expect(parsed.evidence).toHaveLength(1);
  });

  it("rejects explanations without evidence", () => {
    expect(() =>
      growthInsightExplanationSchema.parse({
        finding: "Test",
        explanation: "Test",
        recommendedAction: "Test",
        evidence: [],
        expectedHypothesis: "Test",
        measurementPlan: "Test",
      }),
    ).toThrow();
  });
});
