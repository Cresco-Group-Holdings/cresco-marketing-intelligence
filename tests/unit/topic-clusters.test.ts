import { describe, expect, it } from "vitest";
import { buildDeterministicClusters } from "@/lib/topics/cluster-rules";
import { buildClusterGraph } from "@/lib/topics/graph-builder";
import { calculateFunnelCoverage } from "@/lib/topics/funnel-coverage";
import { calculatePriorityScore } from "@/lib/topics/priority-scoring";
import { canTransitionRoadmap } from "@/lib/topics/roadmap";

describe("deterministic clustering", () => {
  it("groups keywords by shared entities", () => {
    const clusters = buildDeterministicClusters([
      {
        id: "k1",
        keyword: "email marketing tips",
        normalisedKeyword: "email marketing tips",
        primaryIntent: "INFORMATIONAL",
        entities: [{ entityType: "SERVICE", canonicalValue: "email marketing" }],
      },
      {
        id: "k2",
        keyword: "email marketing guide",
        normalisedKeyword: "email marketing guide",
        primaryIntent: "INFORMATIONAL",
        entities: [{ entityType: "SERVICE", canonicalValue: "email marketing" }],
      },
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].keywordIds).toHaveLength(2);
  });

  it("preserves locked cluster memberships", () => {
    const clusters = buildDeterministicClusters([
      {
        id: "k1",
        keyword: "locked kw",
        normalisedKeyword: "locked kw",
        primaryIntent: "INFORMATIONAL",
        entities: [],
        isLocked: true,
        existingClusterId: "cluster-abc",
      },
      {
        id: "k2",
        keyword: "other kw",
        normalisedKeyword: "other kw",
        primaryIntent: "COMMERCIAL",
        entities: [],
      },
    ]);
    const locked = clusters.find((c) => c.evidence.preservedLocked);
    expect(locked?.keywordIds).toContain("k1");
  });
});

describe("priority scoring", () => {
  it("returns null score when no factors available", () => {
    const result = calculatePriorityScore({});
    expect(result.totalScore).toBeNull();
    expect(result.missingFactors.length).toBeGreaterThan(0);
  });

  it("scores only available factors without fabricating defaults", () => {
    const result = calculatePriorityScore({
      businessRelevance: 0.8,
      impressions: 1000,
    });
    expect(result.totalScore).not.toBeNull();
    expect(result.missingFactors).toContain("existingPosition");
    expect(result.factors.impressions).not.toBeNull();
  });
});

describe("funnel coverage", () => {
  it("maps intents to funnel stages without assuming commercial funnel", () => {
    const coverage = calculateFunnelCoverage({
      keywords: [
        { intent: "INFORMATIONAL", hasPage: true },
        { intent: "SUPPORT", hasPage: false },
        { intent: "UNKNOWN", hasPage: false },
      ],
      pages: [],
    });
    expect(coverage.find((c) => c.stage === "AWARENESS")?.keywordCount).toBe(1);
    expect(coverage.find((c) => c.stage === "SUPPORT")?.keywordCount).toBe(1);
    expect(coverage.find((c) => c.stage === "UNSPECIFIED")?.keywordCount).toBe(1);
  });
});

describe("roadmap transitions", () => {
  it("allows valid transitions", () => {
    expect(canTransitionRoadmap("IDEA", "RESEARCH")).toBe(true);
    expect(canTransitionRoadmap("DRAFTING", "REVIEW")).toBe(true);
  });

  it("blocks invalid transitions", () => {
    expect(canTransitionRoadmap("IDEA", "PUBLISHED")).toBe(false);
    expect(canTransitionRoadmap("ARCHIVED", "IDEA")).toBe(false);
  });
});

describe("cluster graph performance", () => {
  it("truncates large graphs", () => {
    const clusters = Array.from({ length: 50 }, (_, i) => ({
      id: `c${i}`,
      name: `Cluster ${i}`,
      status: "PROPOSED",
    }));
    const keywords = Array.from({ length: 200 }, (_, i) => ({
      id: `k${i}`,
      clusterId: `c${i % 50}`,
      label: `Keyword ${i}`,
    }));
    const graph = buildClusterGraph({ clusters, pillars: [], supporting: [], keywords, gaps: [] });
    expect(graph.truncated).toBe(true);
    expect(graph.nodes.length).toBeLessThanOrEqual(120);
  });
});
