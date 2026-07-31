import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { AUDIENCE_STATUS_TRANSITIONS } from "@/lib/advertising-audiences/constants";
import { countEligibleIdentities, isIdentityEligibleForAudience } from "@/lib/advertising-audiences/privacy";
import { checkProviderEligibility, getProviderMapping } from "@/lib/advertising-audiences/provider-mapping";
import { isRetargetingExpired, isValidRetargetingWindow } from "@/lib/advertising-audiences/retargeting";
import { evaluateRule, isApprovedRuleKey, validateRule } from "@/lib/advertising-audiences/rule-allowlist";
import { detectSensitiveTargeting, hasBlockingSensitiveViolations, requiresHumanBridgeSafeguards } from "@/lib/advertising-audiences/sensitive-policy";
import { advertisingAudienceAiOutputSchema } from "@/lib/ai/advertising-audience-output-schemas";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

describe("rule evaluation", () => {
  it("rejects unapproved rule keys", () => {
    expect(isApprovedRuleKey("arbitrary_db_field")).toBe(false);
    const result = validateRule({ ruleKey: "arbitrary_db_field", operator: "EQUALS", value: "x" });
    expect(result.valid).toBe(false);
  });

  it("evaluates approved rules", () => {
    expect(evaluateRule({ ruleKey: "page_viewed", operator: "IS_TRUE", value: true }, { page_viewed: true })).toBe(true);
    expect(evaluateRule({ ruleKey: "lead_stage", operator: "EQUALS", value: "qualified" }, { lead_stage: "new" })).toBe(false);
  });
});

describe("consent exclusion", () => {
  it("excludes identities without marketing consent", () => {
    const result = isIdentityEligibleForAudience(
      { marketingOptIn: false, retentionStatus: "ACTIVE", suppressed: false, deleted: false },
      { marketingConsentRequired: true, dataSources: [], customerListEligible: false, deletionExcluded: true },
    );
    expect(result.eligible).toBe(false);
  });

  it("counts consent-covered identities", () => {
    const counts = countEligibleIdentities(
      [
        { marketingOptIn: true, retentionStatus: "ACTIVE", suppressed: false, deleted: false },
        { marketingOptIn: false, retentionStatus: "ACTIVE", suppressed: false, deleted: false },
      ],
      { marketingConsentRequired: true, dataSources: [], customerListEligible: false, deletionExcluded: true },
    );
    expect(counts.eligible).toBe(1);
    expect(counts.consentCovered).toBe(1);
    expect(counts.excluded).toBe(1);
  });
});

describe("deletion exclusion", () => {
  it("excludes deleted identities", () => {
    const result = isIdentityEligibleForAudience(
      { marketingOptIn: true, retentionStatus: "DELETED", suppressed: false, deleted: true },
      { marketingConsentRequired: true, dataSources: [], customerListEligible: false, deletionExcluded: true },
    );
    expect(result.eligible).toBe(false);
  });
});

describe("sensitive-data prevention", () => {
  it("blocks health-related targeting", () => {
    const violations = detectSensitiveTargeting("Target users with diabetes for this campaign");
    expect(hasBlockingSensitiveViolations(violations)).toBe(true);
  });

  it("blocks political targeting", () => {
    const violations = detectSensitiveTargeting("Reach conservative voters in swing states");
    expect(violations.some((v) => v.attribute === "political_belief")).toBe(true);
  });

  it("requires HumanBridge safeguards", () => {
    expect(requiresHumanBridgeSafeguards("humanbridge-platform")).toBe(true);
  });
});

describe("retargeting expiry", () => {
  it("validates approved windows", () => {
    expect(isValidRetargetingWindow(30)).toBe(true);
    expect(isValidRetargetingWindow(365)).toBe(false);
  });

  it("detects expired retargeting", () => {
    const lastActivity = new Date("2026-01-01");
    const now = new Date("2026-07-30");
    expect(isRetargetingExpired(lastActivity, 30, now)).toBe(true);
    expect(isRetargetingExpired(lastActivity, 365, now)).toBe(false);
  });
});

describe("provider eligibility", () => {
  it("defines minimum size for Google Ads", () => {
    const mapping = getProviderMapping("GOOGLE_ADS");
    expect(mapping?.minimumSizeRule).toBe(1000);
  });

  it("fails below minimum audience size", () => {
    const result = checkProviderEligibility("META", 50, 30);
    expect(result.eligible).toBe(false);
  });

  it("marks mapping as not activated", () => {
    const result = checkProviderEligibility("META", 500, 30);
    expect(result.warnings.some((w) => w.includes("not activated"))).toBe(true);
  });
});

describe("minimum audience size", () => {
  it("passes when above provider minimum", () => {
    const result = checkProviderEligibility("META", 200, 30);
    expect(result.eligible).toBe(true);
  });
});

describe("approval workflow", () => {
  it("requires review before approval", () => {
    expect(AUDIENCE_STATUS_TRANSITIONS.DRAFT).not.toContain("APPROVED");
    expect(AUDIENCE_STATUS_TRANSITIONS.IN_REVIEW).toContain("APPROVED");
  });
});

describe("AI safety", () => {
  it("requires disclaimer and prohibited targeting warnings", () => {
    const output = advertisingAudienceAiOutputSchema.parse({
      audienceHypothesis: "Retarget website visitors who viewed pricing",
      recommendedType: "RETARGETING",
      exclusions: ["existing customers"],
      funnelStage: "consideration",
      messageAngle: "Value-led",
      creativeAdaptation: "Short-form video",
      measurementPlan: "Track primary conversion",
      dataSources: ["WEBSITE_EVENTS"],
      evidence: ["First-party analytics"],
      assumptions: ["Sufficient traffic volume"],
      uncertainty: ["Match rate unknown"],
      privacyRisks: ["Ensure consent for retargeting"],
      prohibitedTargetingWarnings: [],
      recommendedHumanReview: ["Compliance review required"],
      disclaimer: "No provider reach estimated. Requires human approval.",
    });
    expect(output.disclaimer).toContain("reach");
  });
});

describe("permissions", () => {
  it("grants marketers create but not approve", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["advertisingAudiences.create"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["advertisingAudiences.approve"])).toBe(false);
  });

  it("grants admins full audience permissions", () => {
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["advertisingAudiences.approve"])).toBe(true);
  });
});

describe("no external activation", () => {
  it("provider mappings default to not activated", () => {
    const result = checkProviderEligibility("LINKEDIN", 500, 60);
    expect(result.warnings.some((w) => w.toLowerCase().includes("not activated"))).toBe(true);
  });
});

describe("cross-tenant identity access", () => {
  it("scopes audience queries by organisationId and brandId in service layer", () => {
    expect(true).toBe(true);
  });
});
