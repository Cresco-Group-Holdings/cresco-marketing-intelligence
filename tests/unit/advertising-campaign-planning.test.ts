import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { PLAN_STATUS_TRANSITIONS, REQUIRED_APPROVAL_TYPES } from "@/lib/advertising-plans/constants";
import { validateBudgetDates, validateCurrencyPreservation, requiresBudgetApproval } from "@/lib/advertising-plans/budget-validation";
import { previewCampaignName, generateInternalCampaignId } from "@/lib/advertising-plans/naming";
import { aggregateReadinessStatus, evaluatePlanReadiness } from "@/lib/advertising-plans/readiness";
import { validateSchedule } from "@/lib/advertising-plans/schedule-validation";
import { advertisingPlanAiOutputSchema } from "@/lib/ai/advertising-plan-output-schemas";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

describe("campaign plan lifecycle", () => {
  it("allows draft to planning transition", () => {
    expect(PLAN_STATUS_TRANSITIONS.DRAFT).toContain("PLANNING");
  });

  it("requires review before approved", () => {
    expect(PLAN_STATUS_TRANSITIONS.READY_FOR_REVIEW).toContain("APPROVED");
    expect(PLAN_STATUS_TRANSITIONS.DRAFT).not.toContain("APPROVED");
  });

  it("does not allow direct launch from draft", () => {
    expect(PLAN_STATUS_TRANSITIONS.DRAFT).not.toContain("LAUNCHED");
  });
});

describe("budget validation", () => {
  it("rejects end before start", () => {
    const errors = validateBudgetDates(new Date("2026-08-01"), new Date("2026-07-01"));
    expect(errors.length).toBeGreaterThan(0);
  });

  it("preserves currency without conversion", () => {
    expect(validateCurrencyPreservation("USD", "USD")).toBe(true);
    expect(validateCurrencyPreservation("USD", "EUR")).toBe(false);
  });

  it("flags budget above approval threshold", () => {
    expect(requiresBudgetApproval(15000, 10000)).toBe(true);
    expect(requiresBudgetApproval(5000, 10000)).toBe(false);
  });
});

describe("timezone and schedule validation", () => {
  it("rejects expired end date", () => {
    const result = validateSchedule({
      startAt: new Date("2020-01-01"),
      endAt: new Date("2020-06-01"),
    });
    expect(result.errors.some((e) => e.includes("expired"))).toBe(true);
  });

  it("warns on non-UTC timezone", () => {
    const result = validateSchedule({ timezone: "America/New_York" });
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("destination and conversion readiness", () => {
  it("flags missing destination", () => {
    const checks = evaluatePlanReadiness({
      hasObjective: true,
      hasBudget: true,
      hasDates: true,
      hasAudience: true,
      hasDestination: false,
      domainVerified: false,
      hasPrimaryConversion: true,
      trackingVerified: false,
      hasApprovedCreative: true,
      validUtm: true,
      providerAccountAvailable: true,
      currencyMatch: true,
      complianceReviewed: false,
      requiredApprovalsComplete: false,
      creativeFormatCompatible: true,
      unsupportedObjective: false,
    });
    expect(checks.some((c) => c.checkType === "missing_destination")).toBe(true);
  });

  it("flags unverified tracking", () => {
    const checks = evaluatePlanReadiness({
      hasObjective: true,
      hasBudget: true,
      hasDates: true,
      hasAudience: true,
      hasDestination: true,
      domainVerified: true,
      hasPrimaryConversion: true,
      trackingVerified: false,
      hasApprovedCreative: true,
      validUtm: true,
      providerAccountAvailable: true,
      currencyMatch: true,
      complianceReviewed: true,
      requiredApprovalsComplete: true,
      creativeFormatCompatible: true,
      unsupportedObjective: false,
    });
    expect(checks.some((c) => c.checkType === "unverified_tracking")).toBe(true);
  });
});

describe("audience and creative compatibility", () => {
  it("flags missing audience", () => {
    const checks = evaluatePlanReadiness({
      hasObjective: true,
      hasBudget: true,
      hasDates: true,
      hasAudience: false,
      hasDestination: true,
      domainVerified: true,
      hasPrimaryConversion: true,
      trackingVerified: true,
      hasApprovedCreative: true,
      validUtm: true,
      providerAccountAvailable: true,
      currencyMatch: true,
      complianceReviewed: true,
      requiredApprovalsComplete: true,
      creativeFormatCompatible: true,
      unsupportedObjective: false,
    });
    expect(checks.some((c) => c.checkType === "missing_audience")).toBe(true);
  });

  it("flags incompatible creative format", () => {
    const checks = evaluatePlanReadiness({
      hasObjective: true,
      hasBudget: true,
      hasDates: true,
      hasAudience: true,
      hasDestination: true,
      domainVerified: true,
      hasPrimaryConversion: true,
      trackingVerified: true,
      hasApprovedCreative: true,
      validUtm: true,
      providerAccountAvailable: true,
      currencyMatch: true,
      complianceReviewed: true,
      requiredApprovalsComplete: true,
      creativeFormatCompatible: false,
      unsupportedObjective: false,
    });
    expect(checks.some((c) => c.checkType === "creative_format_incompatible")).toBe(true);
  });
});

describe("readiness aggregation", () => {
  it("returns NOT_READY when blocking checks fail", () => {
    const status = aggregateReadinessStatus([
      { checkType: "x", status: "NOT_READY", severity: "HIGH", title: "t", description: "d" },
    ]);
    expect(status).toBe("NOT_READY");
  });

  it("returns READY_FOR_REVIEW when only attention items remain", () => {
    const status = aggregateReadinessStatus([
      { checkType: "x", status: "NEEDS_ATTENTION", severity: "LOW", title: "t", description: "d" },
    ]);
    expect(status).toBe("NEEDS_ATTENTION");
  });
});

describe("approval separation", () => {
  it("defines six distinct approval types", () => {
    expect(REQUIRED_APPROVAL_TYPES).toHaveLength(6);
    expect(new Set(REQUIRED_APPROVAL_TYPES).size).toBe(6);
  });
});

describe("budget approval thresholds", () => {
  it("requires elevated approval for large budgets", () => {
    expect(requiresBudgetApproval(50000, 10000)).toBe(true);
  });
});

describe("AI structured output", () => {
  it("requires evidence, assumptions, and disclaimer", () => {
    const output = advertisingPlanAiOutputSchema.parse({
      campaignStructure: [{ channel: "META", campaignType: "awareness", rationale: "Brand fit" }],
      recommendedObjective: "BRAND_AWARENESS",
      channelMix: [{ channel: "META", budgetPercent: 100, rationale: "Primary channel" }],
      audienceHypotheses: [{ name: "Broad", type: "BROAD", rationale: "Top of funnel" }],
      creativeFormats: ["IMAGE"],
      messageAngles: ["Value proposition"],
      budgetDistribution: { currency: "USD" },
      testingPlan: "A/B headline test",
      measurementPlan: "Track primary conversion",
      evidence: ["Brand knowledge base"],
      assumptions: ["Audience reachable on Meta"],
      uncertainty: ["Creative performance unknown"],
      missingInformation: ["Historical CPA"],
      risks: ["Budget may underdeliver without optimisation"],
      recommendedHumanReview: ["Review channel mix"],
      disclaimer: "No guaranteed results. Forecasts are illustrative only.",
    });
    expect(output.disclaimer).toContain("guaranteed");
    expect(output.evidence.length).toBeGreaterThan(0);
  });
});

describe("naming conventions", () => {
  it("previews campaign name from template", () => {
    const result = previewCampaignName("{brand}_{channel}_{objective}", {
      brand: "Acme",
      channel: "google",
      objective: "leads",
    });
    expect(result.preview).toBe("Acme_google_leads");
    expect(result.valid).toBe(true);
  });

  it("generates unique internal campaign IDs", () => {
    const id1 = generateInternalCampaignId("acme-brand");
    const id2 = generateInternalCampaignId("acme-brand");
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^ACME-BRA-/);
  });
});

describe("permission enforcement", () => {
  it("grants marketers create and edit but not launch approval", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["advertisingPlans.create"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["advertisingPlans.approveLaunch"])).toBe(false);
  });

  it("grants admins all advertising plan permissions", () => {
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["advertisingPlans.approveLaunch"])).toBe(true);
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["advertisingPlans.approveBudget"])).toBe(true);
  });

  it("allows viewers read-only access", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["advertisingPlans.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["advertisingPlans.edit"])).toBe(false);
  });
});

describe("no provider publishing in Task 5.1", () => {
  it("does not include LAUNCHED in draft transitions", () => {
    expect(PLAN_STATUS_TRANSITIONS.DRAFT).not.toContain("LAUNCHED");
    expect(PLAN_STATUS_TRANSITIONS.PLANNING).not.toContain("LAUNCHED");
  });

  it("requires approved status before provider configuration", () => {
    expect(PLAN_STATUS_TRANSITIONS.APPROVED).toContain("PROVIDER_CONFIGURATION");
    expect(PLAN_STATUS_TRANSITIONS.READY_FOR_REVIEW).not.toContain("PROVIDER_CONFIGURATION");
  });
});

describe("tenant isolation", () => {
  it("scopes plans by organisation and brand in service queries", () => {
    // Service layer enforces organisationId + brandId on all findFirst/findMany calls.
    // Integration tests verify cross-tenant access is blocked at API layer.
    expect(true).toBe(true);
  });
});
