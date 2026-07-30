import { describe, expect, it } from "vitest";
import { generateFunnelInsights } from "@/lib/funnel/insights";
import { enforceSegmentCardinality, isApprovedSegmentDimension } from "@/lib/funnel/segments";
import { sanitiseJourneySamples } from "@/lib/funnel/privacy";
import type { FunnelStepMetrics } from "@/lib/funnel/types";

describe("funnel insights", () => {
  const stepResults: FunnelStepMetrics[] = [
    { stepId: "1", stepOrder: 1, stepName: "Visitor", entrants: 100, completions: 100, stepConversion: 100, cumulativeConversion: 100, dropOffCount: 0, dropOffRate: 0, medianTimeToNextMs: null },
    { stepId: "2", stepOrder: 2, stepName: "Signup started", entrants: 100, completions: 60, stepConversion: 60, cumulativeConversion: 60, dropOffCount: 40, dropOffRate: 40, medianTimeToNextMs: null },
    { stepId: "3", stepOrder: 3, stepName: "Signup completed", entrants: 60, completions: 10, stepConversion: 16.67, cumulativeConversion: 10, dropOffCount: 50, dropOffRate: 83.33, medianTimeToNextMs: null },
  ];

  it("identifies largest drop-off step", () => {
    const insights = generateFunnelInsights(stepResults);
    const dropOff = insights.find((i) => i.insightType === "LARGEST_DROP_OFF");
    expect(dropOff?.stepName).toBe("Signup completed");
    expect(dropOff?.message).toContain("Signup completed");
  });

  it("flags high signup start with low completion", () => {
    const insights = generateFunnelInsights(stepResults);
    expect(insights.some((i) => i.insightType === "HIGH_SIGNUP_LOW_COMPLETION")).toBe(true);
  });

  it("does not infer causes without evidence", () => {
    const insights = generateFunnelInsights(stepResults);
    for (const insight of insights) {
      expect(insight.evidence).toBeDefined();
      expect(Object.keys(insight.evidence).length).toBeGreaterThan(0);
    }
  });
});

describe("segmentation", () => {
  it("only allows approved segment dimensions", () => {
    expect(isApprovedSegmentDimension("CHANNEL")).toBe(true);
    expect(isApprovedSegmentDimension("RAW_EMAIL")).toBe(false);
  });

  it("enforces max segment cardinality", () => {
    const segments = new Map<string, number>();
    for (let i = 0; i < 60; i++) segments.set(`value-${i}`, i);
    const { allowed, rejected } = enforceSegmentCardinality(segments);
    expect(allowed).toHaveLength(50);
    expect(rejected).toHaveLength(10);
  });
});

describe("journey sample privacy", () => {
  it("removes email-like values from samples", () => {
    const samples = sanitiseJourneySamples([
      {
        anonymisedId: "anon_abc123",
        stepsReached: 2,
        completed: false,
        stepTimestamps: ["2026-01-01T00:00:00Z"],
        segmentHints: { email: "user@example.com", channel: "organic" },
      },
    ]);
    expect(samples[0]?.segmentHints?.email).toBeUndefined();
    expect(samples[0]?.segmentHints?.channel).toBe("organic");
  });
});
