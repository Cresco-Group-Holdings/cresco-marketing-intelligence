import { describe, expect, it } from "vitest";
import { compareCrawlRuns } from "@/lib/seo/crawl-comparison";

describe("crawl comparison", () => {
  const baseline = [
    { pageId: "1", normalisedUrl: "https://example.com/", statusCode: 200, title: "Home", description: "Desc", canonicalUrl: null, robotsDirective: null, contentHash: "a" },
    { pageId: "2", normalisedUrl: "https://example.com/old", statusCode: 200, title: "Old", description: null, canonicalUrl: null, robotsDirective: null, contentHash: "b" },
  ];

  const current = [
    { pageId: "1", normalisedUrl: "https://example.com/", statusCode: 200, title: "Home Updated", description: "Desc", canonicalUrl: null, robotsDirective: null, contentHash: "a" },
    { pageId: "3", normalisedUrl: "https://example.com/new", statusCode: 200, title: "New", description: null, canonicalUrl: null, robotsDirective: null, contentHash: "c" },
  ];

  it("identifies new and removed pages", () => {
    const result = compareCrawlRuns(baseline, current, 5, 3);
    expect(result.newPages).toContain("https://example.com/new");
    expect(result.removedPages).toContain("https://example.com/old");
  });

  it("detects title changes", () => {
    const result = compareCrawlRuns(baseline, current, 5, 3);
    expect(result.titleChanges).toHaveLength(1);
    expect(result.titleChanges[0]?.from).toBe("Home");
    expect(result.titleChanges[0]?.to).toBe("Home Updated");
  });

  it("calculates issue delta", () => {
    const result = compareCrawlRuns(baseline, current, 10, 7);
    expect(result.issueDelta.net).toBe(-3);
    expect(result.issueDelta.resolved).toBe(3);
  });
});
