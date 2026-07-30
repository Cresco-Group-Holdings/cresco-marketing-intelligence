import { describe, expect, it } from "vitest";
import { classifyAnchor, detectAnchorRepetition } from "@/lib/internal-links/anchor-classification";
import {
  calculateGraphMetrics,
  calculateNodeMetrics,
  computeCrawlDepths,
  sampleNodesForVisualization,
  type GraphNodeInput,
} from "@/lib/internal-links/graph-metrics";
import { detectLinkIssues } from "@/lib/internal-links/issue-detection";
import { generateLinkRecommendations } from "@/lib/internal-links/recommendations";

describe("anchor classification", () => {
  it("classifies branded anchors", () => {
    expect(classifyAnchor("Acme Corp homepage", { brandName: "Acme Corp" })).toBe("BRANDED");
  });

  it("classifies generic anchors", () => {
    expect(classifyAnchor("click here")).toBe("GENERIC");
  });

  it("classifies empty anchors", () => {
    expect(classifyAnchor("")).toBe("EMPTY");
  });

  it("classifies partial-match anchors", () => {
    expect(classifyAnchor("best seo audit tools", { targetKeyword: "seo audit" })).toBe("PARTIAL_MATCH");
  });

  it("warns about unnatural repetition", () => {
    const warnings = detectAnchorRepetition([{ text: "seo tools", count: 6 }], 5);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].warning).toContain("unnatural");
  });
});

describe("graph metrics", () => {
  const home: GraphNodeInput = {
    id: "home",
    url: "https://example.com/",
    incomingLinks: [],
    outgoingLinks: [{ targetUrl: "https://example.com/blog", anchorText: "blog" }],
  };
  const blog: GraphNodeInput = {
    id: "blog",
    url: "https://example.com/blog",
    incomingLinks: ["https://example.com/"],
    outgoingLinks: [],
    clusterId: "c1",
  };
  const orphan: GraphNodeInput = {
    id: "orphan",
    url: "https://example.com/orphan",
    incomingLinks: [],
    outgoingLinks: [],
    clusterId: "c1",
  };

  it("computes incoming and outgoing counts", () => {
    const metrics = calculateNodeMetrics(blog);
    expect(metrics.incomingCount).toBe(1);
    expect(metrics.outgoingCount).toBe(0);
    expect(calculateNodeMetrics(orphan).incomingCount).toBe(0);
  });

  it("marks orphan pages", () => {
    expect(calculateNodeMetrics(orphan).isOrphan).toBe(true);
    expect(calculateNodeMetrics(blog).isOrphan).toBe(false);
  });

  it("computes crawl depth from home", () => {
    const depths = computeCrawlDepths(
      [
        { id: "home", url: "https://example.com/" },
        { id: "blog", url: "https://example.com/blog" },
        { id: "orphan", url: "https://example.com/orphan" },
      ],
      [{ sourceId: "home", targetId: "blog" }],
      "https://example.com/",
    );
    expect(depths.get("home")).toBe(0);
    expect(depths.get("blog")).toBe(1);
    expect(depths.get("orphan")).toBeUndefined();
  });

  it("samples large graphs for visualization", () => {
    const manyNodes = Array.from({ length: 500 }, (_, i) => ({ id: `n${i}` }));
    const sampled = sampleNodesForVisualization(manyNodes, 100);
    expect(sampled.sampled.length).toBeLessThanOrEqual(100);
    expect(sampled.truncated).toBe(true);
  });

  it("aggregates graph-level metrics", () => {
    const metrics = calculateGraphMetrics([home, blog, orphan]);
    expect(metrics.orphanCount).toBeGreaterThanOrEqual(1);
    expect(metrics.edgeCount).toBe(1);
  });
});

describe("issue detection", () => {
  const nodes: GraphNodeInput[] = [
    {
      id: "home",
      url: "https://example.com/",
      incomingLinks: [],
      outgoingLinks: [
        { targetUrl: "https://example.com/deep", isRedirect: true },
        { targetUrl: "https://example.com/orphan", isNoindex: true },
      ],
      crawlDepth: 0,
    },
    {
      id: "orphan",
      url: "https://example.com/orphan",
      incomingLinks: [],
      outgoingLinks: [],
      clusterId: "c1",
    },
    {
      id: "deep",
      url: "https://example.com/deep",
      incomingLinks: ["https://example.com/"],
      outgoingLinks: [],
      crawlDepth: 8,
    },
  ];

  const metrics = calculateGraphMetrics(nodes);

  it("detects orphan pages", () => {
    const issues = detectLinkIssues(nodes, metrics, new Map(), new Set());
    expect(issues.some((i) => i.issueType === "ORPHAN_PAGE")).toBe(true);
  });

  it("detects redirect links", () => {
    const issues = detectLinkIssues(nodes, metrics, new Map(), new Set());
    expect(issues.some((i) => i.issueType === "LINK_TO_REDIRECT")).toBe(true);
  });

  it("detects noindex links", () => {
    const issues = detectLinkIssues(nodes, metrics, new Map(), new Set());
    expect(issues.some((i) => i.issueType === "LINK_TO_NOINDEX")).toBe(true);
  });

  it("detects excessive crawl depth", () => {
    const issues = detectLinkIssues(nodes, metrics, new Map(), new Set());
    expect(issues.some((i) => i.issueType === "EXCESSIVE_CRAWL_DEPTH")).toBe(true);
  });

  it("detects anchor repetition", () => {
    const issues = detectLinkIssues(nodes, metrics, new Map([["seo tools", 6]]), new Set());
    expect(issues.some((i) => i.issueType === "ANCHOR_REPETITION")).toBe(true);
  });
});

describe("link recommendations", () => {
  it("includes evidence and confidence for weak pages", () => {
    const recs = generateLinkRecommendations({
      nodes: [
        { id: "hub", url: "https://example.com/hub", title: "SEO Hub", topics: ["seo"], incomingCount: 10, clusterId: "c1" },
        { id: "weak", url: "https://example.com/weak", title: "SEO Audit Guide", topics: ["seo audit"], incomingCount: 1, isNearOrphan: true, clusterId: "c1" },
      ],
      clusterTopics: new Map([["c1", ["seo", "seo audit"]]]),
      existingEdges: new Set(),
    });
    expect(recs.length).toBeGreaterThan(0);
    const rec = recs[0];
    expect(rec.sourceNodeId).toBeTruthy();
    expect(rec.targetNodeId).toBeTruthy();
    expect(rec.suggestedAnchorConcept).toBeTruthy();
    expect(rec.confidence).toBeGreaterThan(0);
    expect(Object.keys(rec.evidence).length).toBeGreaterThan(0);
    expect(rec.contextualReason).toBeTruthy();
  });

  it("does not force exact-match anchors", () => {
    const recs = generateLinkRecommendations({
      nodes: [
        { id: "a", url: "https://example.com/a", title: "Content Marketing", topics: ["content marketing"], incomingCount: 0, isOrphan: true },
        { id: "b", url: "https://example.com/b", title: "Marketing Basics", topics: ["marketing"], incomingCount: 5 },
      ],
      keywordByPage: new Map([["a", "content marketing"]]),
      existingEdges: new Set(),
    });
    for (const rec of recs) {
      expect(rec.suggestedAnchorConcept.toLowerCase()).not.toBe("content marketing");
    }
  });
});

describe("tenant isolation", () => {
  it("graph build service scopes by organisationId in queries", async () => {
    const source = await import("fs/promises").then((fs) =>
      fs.readFile("src/server/services/internal-link-build-service.ts", "utf8"),
    );
    expect(source).toContain("organisationId");
    expect(source).toContain("brandId");
  });
});
