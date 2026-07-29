import { describe, expect, it } from "vitest";
import { runPolicyRuleChecks } from "@/lib/compliance/deterministic-checks";
import { isNonOverridable } from "@/lib/compliance/constants";

describe("compliance deterministic checks", () => {
  it("detects prohibited grant success guarantees", () => {
    const findings = runPolicyRuleChecks({
      contentText: "We guarantee grant approval for every applicant.",
      disclaimer: null,
      rules: [
        {
          id: "rule-1",
          ruleKey: "GRANT_SUCCESS_GUARANTEE",
          category: "GRANTS",
          title: "No guarantee of grant success",
          riskLevel: "BLOCKING",
          isBlocking: true,
          canOverride: false,
          matchPattern: "guaranteed?\\s+(approval|funding|grant|success)",
        },
      ],
      requiredDisclaimers: [],
    });
    expect(findings.some((finding) => finding.ruleKey === "GRANT_SUCCESS_GUARANTEE")).toBe(true);
    expect(findings[0]?.isBlocking).toBe(true);
  });

  it("flags missing required disclaimer", () => {
    const findings = runPolicyRuleChecks({
      contentText: "Apply for funding today.",
      disclaimer: "",
      rules: [],
      requiredDisclaimers: [
        {
          disclaimerText: "Grant outcomes are not guaranteed.",
          isBlocking: true,
        },
      ],
    });
    expect(findings.some((finding) => finding.ruleKey === "MISSING_REQUIRED_DISCLAIMER")).toBe(true);
  });

  it("marks unsupported media format as non-overridable", () => {
    expect(isNonOverridable("UNSUPPORTED_PLATFORM_FORMAT")).toBe(true);
    expect(isNonOverridable("GRANT_SUCCESS_GUARANTEE")).toBe(false);
  });
});
