import { describe, expect, it } from "vitest";
import { evaluateQualificationRules } from "@/lib/leads/qualification-rules";

describe("evaluateQualificationRules", () => {
  it("marks Cresco Grants leads qualified when required fields are present", () => {
    const result = evaluateQualificationRules("CRESCO_GRANTS_INTELLIGENCE", {
      organisationType: "SME",
      fundingNeed: "R&D grant",
      location: "UK",
      grantInterest: "Innovate UK",
    });
    expect(result.qualified).toBe(true);
    expect(result.missingFields).toEqual([]);
  });

  it("flags missing Capital Cresco Terminal fields", () => {
    const result = evaluateQualificationRules("CAPITAL_CRESCO_TERMINAL", {
      investorOrAnalystType: "Analyst",
    });
    expect(result.qualified).toBe(false);
    expect(result.missingFields).toContain("researchNeed");
    expect(result.missingFields).toContain("organisation");
  });
});
