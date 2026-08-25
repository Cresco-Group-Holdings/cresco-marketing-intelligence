import { describe, expect, it } from "vitest";
import {
  buildCommandCentreAttributedRevenueKpi,
  resolveBlendedRoas,
  resolveMixedCurrencyRevenueTotal,
  resolveRevenueSemantics,
  resolveUnattributedRevenue,
} from "@/lib/unified-analytics/revenue-semantics";
import { unavailableValue } from "@/lib/marketing-intelligence/format";

describe("revenue semantics", () => {
  it("keeps observed, attributed and unattributed revenue distinct", () => {
    const semantics = resolveRevenueSemantics({
      observedRevenue: 100_000,
      attributedRevenue: 72_000,
      channelBreakdown: [
        { channel: "Meta Ads", creditPercent: 60, creditValue: 43_200, conversions: 1 },
        { channel: "Google Ads", creditPercent: 40, creditValue: 28_800, conversions: 1 },
      ],
    });

    expect(semantics.observedRevenue).toBe(100_000);
    expect(semantics.attributedRevenue).toBe(72_000);
    expect(semantics.unattributedRevenue).toBe(28_000);
    expect(semantics.influencedRevenue).toBeNull();
  });

  it("does not expose influenced revenue as a fallback metric", () => {
    const semantics = resolveRevenueSemantics({
      observedRevenue: 50_000,
      attributedRevenue: null,
      channelBreakdown: [],
    });

    expect(semantics.attributedRevenue).toBeNull();
    expect(semantics.unattributedRevenue).toBe(50_000);
    expect(semantics.influencedRevenue).toBeNull();
  });

  it("treats all observed revenue as unattributed when attribution is unavailable", () => {
    expect(resolveUnattributedRevenue(12_500, null)).toBe(12_500);
    expect(resolveUnattributedRevenue(12_500, 0)).toBe(12_500);
  });

  it("builds Command Centre attributed revenue KPI without observed fallback", () => {
    const withAttribution = buildCommandCentreAttributedRevenueKpi(18_400, "GBP");
    const withoutAttribution = buildCommandCentreAttributedRevenueKpi(null, "GBP");

    expect(withAttribution.label).toBe("Attributed Revenue");
    expect(withAttribution.value).toContain("18,400");
    expect(withoutAttribution.value).toBe(unavailableValue());
    expect(withoutAttribution.stateMessage).toContain("Attribution unavailable");
  });
});

describe("blended ROAS contract", () => {
  it("calculates ROAS from paid-attributable revenue", () => {
    expect(resolveBlendedRoas(10_000, 38_000)).toBe(3.8);
  });

  it("returns unavailable when only global observed revenue exists", () => {
    expect(resolveBlendedRoas(10_000, null)).toBeNull();
  });

  it("returns unavailable when there is no revenue", () => {
    expect(resolveBlendedRoas(10_000, 0)).toBeNull();
    expect(resolveBlendedRoas(0, 5_000)).toBeNull();
  });

  it("returns unavailable under partial paid attribution when paid credit is zero", () => {
    const semantics = resolveRevenueSemantics({
      observedRevenue: 100_000,
      attributedRevenue: 15_000,
      channelBreakdown: [
        { channel: "Instagram Organic", creditPercent: 100, creditValue: 15_000, conversions: 1 },
      ],
    });

    expect(semantics.paidAttributedRevenue).toBeNull();
    expect(resolveBlendedRoas(12_000, semantics.paidAttributedRevenue)).toBeNull();
  });
});

describe("mixed currency safety", () => {
  it("normalizes compatible currencies into reporting currency", () => {
    const result = resolveMixedCurrencyRevenueTotal({
      reportingCurrency: "GBP",
      rates: [
        {
          fromCurrency: "USD",
          toCurrency: "GBP",
          rate: 0.8,
          rateDate: new Date("2026-02-01T00:00:00Z"),
          source: "test",
        },
      ],
      observations: [
        { provider: "STRIPE", amount: 1000, currency: "GBP" },
        { provider: "STRIPE", amount: 1000, currency: "USD" },
      ],
    });

    expect(result.unavailable).toBe(false);
    expect(result.total).toBe(1800);
    expect(result.reportingCurrency).toBe("GBP");
  });

  it("returns unavailable when FX rates are missing", () => {
    const result = resolveMixedCurrencyRevenueTotal({
      reportingCurrency: "GBP",
      rates: [],
      observations: [
        { provider: "STRIPE", amount: 1000, currency: "GBP" },
        { provider: "STRIPE", amount: 1000, currency: "USD" },
      ],
    });

    expect(result.unavailable).toBe(true);
    expect(result.total).toBeNull();
    expect(result.warnings.some((warning) => warning.includes("USD"))).toBe(true);
  });
});
