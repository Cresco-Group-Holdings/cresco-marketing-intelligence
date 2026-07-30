import { describe, expect, it } from "vitest";
import { evaluateOpportunities } from "@/lib/keywords/opportunity-rules";

describe("keyword opportunity rules", () => {
  it("detects high impressions low CTR", () => {
    const opps = evaluateOpportunities("seo tools", {
      impressions: 1000,
      ctr: 0.005,
    });
    expect(opps.some((o) => o.opportunityType === "HIGH_IMPRESSIONS_LOW_CTR")).toBe(true);
  });

  it("detects striking distance position", () => {
    const opps = evaluateOpportunities("seo agency", { averagePosition: 8 });
    expect(opps.some((o) => o.opportunityType === "POSITION_4_TO_20")).toBe(true);
  });

  it("requires minimum data for impressions opportunity", () => {
    const opps = evaluateOpportunities("test", { impressions: 10, ctr: 0.001 });
    expect(opps.some((o) => o.opportunityType === "HIGH_IMPRESSIONS_LOW_CTR")).toBe(false);
  });
});
