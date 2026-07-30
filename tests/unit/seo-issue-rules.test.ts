import { describe, expect, it } from "vitest";
import {
  evaluatePageRules,
  findDuplicateContentHashes,
  validateHreflang,
} from "@/lib/seo/issue-rules";

describe("SEO issue rules", () => {
  it("detects 4xx pages", () => {
    const issues = evaluatePageRules({ url: "https://example.com/404", finalUrl: "https://example.com/404", statusCode: 404 });
    expect(issues.some((i) => i.ruleId === "HTTP_4XX")).toBe(true);
  });

  it("detects missing title", () => {
    const issues = evaluatePageRules({
      url: "https://example.com/",
      finalUrl: "https://example.com/",
      statusCode: 200,
      extraction: {
        title: undefined,
        description: "desc",
        metaRobots: undefined,
        canonical: undefined,
        hreflang: [],
        headings: [],
        textLength: 500,
        internalLinks: [],
        externalLinks: [],
        images: [],
        openGraph: {},
        twitterCard: {},
        paginationLinks: [],
        structuredData: [],
        forms: 0,
        scripts: 0,
        stylesheets: 0,
      },
    });
    expect(issues.some((i) => i.ruleId === "MISSING_TITLE")).toBe(true);
  });

  it("detects redirect chains", () => {
    const issues = evaluatePageRules({
      url: "https://example.com/a",
      finalUrl: "https://example.com/c",
      statusCode: 200,
      redirectChain: ["https://example.com/a", "https://example.com/b", "https://example.com/c"],
    });
    expect(issues.some((i) => i.ruleId === "REDIRECT_CHAIN")).toBe(true);
  });

  it("finds duplicate content hashes", () => {
    const issues = findDuplicateContentHashes([
      { url: "https://example.com/a", contentHash: "abc" },
      { url: "https://example.com/b", contentHash: "abc" },
    ]);
    expect(issues).toHaveLength(2);
    expect(issues[0]?.ruleId).toBe("DUPLICATE_CONTENT_HASH");
  });

  it("validates hreflang", () => {
    const issues = validateHreflang([{ lang: "invalid", href: "https://example.com/" }]);
    expect(issues.length).toBeGreaterThan(0);
  });
});
