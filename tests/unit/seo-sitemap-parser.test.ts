import { describe, expect, it } from "vitest";
import { parseSitemapXml } from "@/lib/seo/sitemap-parser";

describe("sitemap parser", () => {
  it("parses urlset", () => {
    const xml = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc><lastmod>2026-01-01</lastmod></url>
  <url><loc>https://example.com/about</loc></url>
</urlset>`;
    const parsed = parseSitemapXml(xml);
    expect(parsed.type).toBe("urlset");
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.entries[0]?.loc).toBe("https://example.com/");
  });

  it("parses sitemap index", () => {
    const xml = `<?xml version="1.0"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-1.xml</loc></sitemap>
</sitemapindex>`;
    const parsed = parseSitemapXml(xml);
    expect(parsed.type).toBe("sitemapindex");
    expect(parsed.childSitemaps).toContain("https://example.com/sitemap-1.xml");
  });
});
