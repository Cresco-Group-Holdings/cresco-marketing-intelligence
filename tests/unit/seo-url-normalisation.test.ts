import { describe, expect, it } from "vitest";
import { normaliseUrl, resolveRelativeUrl, urlsEquivalent } from "@/lib/seo/url-normalisation";

describe("URL normalisation", () => {
  it("lowercases hostname", () => {
    const result = normaliseUrl("https://Example.COM/Path");
    expect(result.hostname).toBe("example.com");
    expect(result.normalised).toBe("https://example.com/Path");
  });

  it("removes trailing slash", () => {
    const result = normaliseUrl("https://example.com/about/");
    expect(result.normalised).toBe("https://example.com/about");
  });

  it("strips tracking parameters", () => {
    const result = normaliseUrl("https://example.com/page?utm_source=google&id=1");
    expect(result.normalised).toBe("https://example.com/page?id=1");
  });

  it("strips fragments", () => {
    const result = normaliseUrl("https://example.com/page#section");
    expect(result.normalised).toBe("https://example.com/page");
  });

  it("does not merge uncertain URLs", () => {
    const a = normaliseUrl("not-a-url");
    expect(a.uncertain).toBe(true);
    expect(urlsEquivalent("not-a-url", "also-bad")).toBe(false);
  });

  it("resolves relative URLs", () => {
    expect(resolveRelativeUrl("https://example.com/dir/", "../other")).toBe("https://example.com/other");
  });
});
