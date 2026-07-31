import { describe, expect, it } from "vitest";
import { isPathAllowed, parseRobotsTxt } from "@/lib/seo/robots-parser";

describe("robots.txt parser", () => {
  const robots = `
User-agent: *
Disallow: /private/
Allow: /private/public.html
Crawl-delay: 2

Sitemap: https://example.com/sitemap.xml
`;

  it("parses rules and sitemaps", () => {
    const parsed = parseRobotsTxt(robots);
    expect(parsed.sitemaps).toContain("https://example.com/sitemap.xml");
    expect(parsed.crawlDelay).toBe(2);
    expect(parsed.rules.length).toBeGreaterThan(0);
  });

  it("respects disallow rules", () => {
    const parsed = parseRobotsTxt(robots);
    expect(isPathAllowed(parsed, "/private/secret", "CrescoSEOBot").allowed).toBe(false);
    expect(isPathAllowed(parsed, "/public", "CrescoSEOBot").allowed).toBe(true);
  });
});
