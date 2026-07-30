import { describe, expect, it } from "vitest";
import { resolveCreativeLink, generatePaidAdsQualityWarnings } from "@/lib/paid-ads/creative-linking";

describe("paid ads creative linking", () => {
  it("uses explicit user mapping when provided", () => {
    const result = resolveCreativeLink({
      providerCreativeId: "cr-1",
      explicitContentItemId: "content-123",
    });
    expect(result.mappingSource).toBe("EXPLICIT_USER_MAPPING");
    expect(result.contentItemId).toBe("content-123");
  });

  it("does not guess from similar text", () => {
    const result = resolveCreativeLink({ providerCreativeId: "cr-1" });
    expect(result.mappingSource).toBeNull();
  });

  it("links via deterministic provider id", () => {
    const result = resolveCreativeLink({
      providerCreativeId: "cr-1",
      contentVariantProviderId: "variant-abc",
    });
    expect(result.mappingSource).toBe("DETERMINISTIC_PROVIDER_ID");
    expect(result.contentVariantId).toBe("variant-abc");
  });
});

describe("paid ads quality warnings", () => {
  it("flags spend without conversions", () => {
    const warnings = generatePaidAdsQualityWarnings({ spend: 500, conversions: 0, currency: "USD" });
    expect(warnings.some((w) => w.rule === "spend_without_conversions")).toBe(true);
  });

  it("flags missing currency", () => {
    const warnings = generatePaidAdsQualityWarnings({ spend: 100, conversions: 5 });
    expect(warnings.some((w) => w.rule === "missing_currency")).toBe(true);
  });

  it("does not pause campaigns", () => {
    const warnings = generatePaidAdsQualityWarnings({
      spend: 500,
      conversions: 0,
      campaignStatus: "PAUSED",
    });
    expect(warnings.every((w) => !w.title.toLowerCase().includes("pause"))).toBe(true);
  });
});
