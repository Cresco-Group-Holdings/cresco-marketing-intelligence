import { describe, expect, it } from "vitest";
import { keywordsEquivalent, normaliseKeyword } from "@/lib/keywords/normalisation";

describe("keyword normalisation", () => {
  it("collapses whitespace and lowercases", () => {
    const result = normaliseKeyword("  Best   SEO Tools  ");
    expect(result.normalised).toBe("best seo tools");
    expect(result.display).toBe("Best SEO Tools");
  });

  it("preserves phrase order", () => {
    const a = normaliseKeyword("seo agency london");
    const b = normaliseKeyword("london seo agency");
    expect(a.normalised).not.toBe(b.normalised);
  });

  it("separates by locale", () => {
    const en = normaliseKeyword("marketing", { language: "en", country: "GB" });
    const us = normaliseKeyword("marketing", { language: "en", country: "US" });
    expect(keywordsEquivalent("marketing", "marketing", "en", "GB")).toBe(true);
    expect(en.country).toBe("GB");
    expect(us.country).toBe("US");
  });

  it("normalises unicode", () => {
    const result = normaliseKeyword("café marketing");
    expect(result.normalised).toContain("caf");
  });
});
