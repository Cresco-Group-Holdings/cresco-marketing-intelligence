import { describe, expect, it } from "vitest";
import {
  isBlockedCrawlPath,
  truncateExcerpt,
  validateCompetitorDomain,
} from "@/lib/competitors/crawl-policy";
import { detectContentGaps } from "@/lib/competitors/content-gap";
import { calculateKeywordOverlaps, overlapSummary } from "@/lib/competitors/overlap-analysis";
import { comparePages } from "@/lib/competitors/page-comparison";

describe("competitor domain validation", () => {
  it("accepts valid public domains", () => {
    expect(validateCompetitorDomain("example.com").valid).toBe(true);
  });

  it("rejects invalid domain format", () => {
    expect(validateCompetitorDomain("not a domain").valid).toBe(false);
  });

  it("rejects private/internal hosts via SSRF guard", () => {
    expect(validateCompetitorDomain("localhost").valid).toBe(false);
    expect(validateCompetitorDomain("127.0.0.1").valid).toBe(false);
  });
});

describe("restricted crawl policy", () => {
  it("blocks authenticated and admin paths", () => {
    expect(isBlockedCrawlPath("/login")).toBe(true);
    expect(isBlockedCrawlPath("/wp-admin/settings")).toBe(true);
    expect(isBlockedCrawlPath("/about")).toBe(false);
  });

  it("truncates excerpts for copyright-safe summaries", () => {
    const long = "a".repeat(600);
    const excerpt = truncateExcerpt(long, 500);
    expect(excerpt.length).toBeLessThanOrEqual(501);
    expect(excerpt.endsWith("…")).toBe(true);
  });
});

describe("keyword overlap analysis", () => {
  it("calculates shared, brand-unique, and competitor-unique keywords", () => {
    const overlaps = calculateKeywordOverlaps(
      [{ keyword: "shared kw", normalisedKeyword: "shared kw", position: 5, url: "/a" }],
      [
        { keyword: "shared kw", normalisedKeyword: "shared kw", position: 3, url: "/b", source: "MANUAL" },
        { keyword: "comp only", normalisedKeyword: "comp only", source: "SERP_OBSERVATION" },
      ],
    );
    const summary = overlapSummary(overlaps);
    expect(summary.shared).toBe(1);
    expect(summary.brandUnique).toBe(0);
    expect(summary.competitorUnique).toBe(1);
  });

  it("flags missing source coverage", () => {
    const overlaps = calculateKeywordOverlaps(
      [],
      [{ keyword: "comp only", normalisedKeyword: "comp only", source: "MANUAL" }],
    );
    expect(overlaps[0].sourceCoverage.hasBrandData).toBe(false);
    expect(overlaps[0].sourceCoverage.hasCompetitorData).toBe(true);
    expect(overlapSummary(overlaps).withMissingSource).toBe(1);
  });
});

describe("content gap detection", () => {
  it("detects topic and missing-page gaps with evidence", () => {
    const gaps = detectContentGaps({
      brandPages: [{ url: "https://brand.test/", wordCount: 100 }],
      competitorPages: [
        { url: "https://comp.test/guide", wordCount: 800, topics: ["widgets"], contentType: "blog" },
      ],
      competitorTopics: ["widgets"],
      brandTopics: [],
      keywordGaps: [{ keyword: "widgets guide", competitorUrl: "https://comp.test/guide" }],
    });
    expect(gaps.some((g) => g.gapType === "TOPIC_COVERAGE")).toBe(true);
    expect(gaps.some((g) => g.gapType === "MISSING_PAGE")).toBe(true);
    expect(gaps.some((g) => g.gapType === "MISSING_FORMAT")).toBe(true);
    for (const gap of gaps) {
      expect(gap.originalityGuidance.length).toBeGreaterThan(10);
      expect(gap.recommendedAction.length).toBeGreaterThan(10);
    }
  });
});

describe("page comparison", () => {
  it("compares structure without reproducing full competitor text", () => {
    const longHeading = "x".repeat(200);
    const result = comparePages({
      brandHeadings: [{ level: 1, text: "Brand title" }],
      competitorHeadings: [{ level: 1, text: longHeading }],
      brandTopics: ["pricing"],
      competitorTopics: ["pricing", "features"],
    });
    expect(result.comparison.headings.competitor[0].length).toBeLessThanOrEqual(101);
    expect(result.comparison.topics.shared).toContain("pricing");
    expect(result.comparison.topics.competitorOnly).toContain("features");
    expect(result.limitations).toContain("not reproduced");
  });
});
