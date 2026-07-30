import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { linkedInAdsAdapter } from "@/lib/advertising-linkedin-ads/adapter";
import { evaluateBudgetGuardrails } from "@/lib/advertising-linkedin-ads/budget-guardrails";
import { mapPlanToLinkedInAdsDraft } from "@/lib/advertising-linkedin-ads/draft-mapper";
import { classifyLinkedInLaunchError } from "@/lib/advertising-linkedin-ads/error-recovery";
import { buildLaunchIdempotencyKey } from "@/lib/advertising-linkedin-ads/idempotency";
import { evaluateLaunchApprovals } from "@/lib/advertising-linkedin-ads/launch-approval";
import { buildMutationOperations, hashMutationPlan, materialChangeInvalidatesApproval } from "@/lib/advertising-linkedin-ads/mutation-plan";
import { translatePlanObjective, isSupportedObjective } from "@/lib/advertising-linkedin-ads/objective-mapper";
import { validateTargetingPolicy } from "@/lib/advertising-linkedin-ads/targeting-policy";
import { validateLinkedInAdsDraft } from "@/lib/advertising-linkedin-ads/validation";
import { isCapabilityAvailable, LINKEDIN_ADS_CAPABILITIES } from "@/lib/advertising-providers/capability-gates";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const samplePlan = {
  planId: "plan_li",
  planName: "LinkedIn Lead Gen",
  internalCampaignId: "BRAND_LI_LEAD",
  primaryObjective: "LEAD_GENERATION",
  reportingCurrency: "USD",
  channels: [{ channelType: "LINKEDIN" }],
  budgets: [{ budgetType: "DAILY", currency: "USD", amount: 100 }],
  destinations: [{ destinationUrl: "https://example.com/landing" }],
  creatives: [{ format: "SINGLE_IMAGE", headline: "Get started", description: "Learn more." }],
};

describe("capability gates", () => {
  it("enables website visits", () => {
    expect(isCapabilityAvailable(LINKEDIN_ADS_CAPABILITIES, "website_visits")).toBe(true);
  });

  it("disables document ads", () => {
    expect(isCapabilityAvailable(LINKEDIN_ADS_CAPABILITIES, "document_ads")).toBe(false);
  });
});

describe("objective mapping", () => {
  it("translates lead generation", () => {
    const result = translatePlanObjective("LEAD_GENERATION");
    expect(result.linkedInObjective).toBe("LEAD_GENERATION");
    expect(result.supported).toBe(true);
  });

  it("rejects unsupported objectives", () => {
    expect(isSupportedObjective("APP_INSTALLS")).toBe(false);
  });
});

describe("targeting policy", () => {
  it("allows job-function targeting", () => {
    const result = validateTargetingPolicy({ countries: ["US"], jobFunctions: ["marketing"] });
    expect(result.allowed).toBe(true);
  });

  it("blocks discriminatory age targeting", () => {
    const result = validateTargetingPolicy({ countries: ["US"], age: 25 });
    expect(result.allowed).toBe(false);
  });
});

describe("draft mapper", () => {
  it("maps plan to campaign group campaign creative hierarchy", () => {
    const draft = mapPlanToLinkedInAdsDraft(samplePlan);
    expect(draft.campaign.type).toBe("SPONSORED_CONTENT");
    expect(draft.campaignGroup.status).toBe("PAUSED");
  });

  it("requires LinkedIn channel", () => {
    expect(() => mapPlanToLinkedInAdsDraft({ ...samplePlan, channels: [{ channelType: "GOOGLE_SEARCH" }] })).toThrow();
  });
});

describe("mutation plan", () => {
  it("hashes operations deterministically", () => {
    const draft = mapPlanToLinkedInAdsDraft(samplePlan);
    const preview = buildMutationOperations(draft, { linkedInAccountId: "123" });
    expect(hashMutationPlan(preview.operations)).toHaveLength(64);
  });

  it("invalidates approval on material budget change", () => {
    expect(materialChangeInvalidatesApproval(["budget"])).toBe(true);
    expect(materialChangeInvalidatesApproval(["name"])).toBe(false);
  });

  it("builds idempotency key", () => {
    expect(buildLaunchIdempotencyKey("p1", "hash", 1)).toHaveLength(64);
  });
});

describe("exact-plan approval", () => {
  it("requires all gates approved with matching hash", () => {
    const hash = "abc123";
    const approvals = ["CAMPAIGN", "CREATIVE", "COMPLIANCE", "BUDGET", "CONVERSION", "ACCOUNT_PERMISSION", "PROVIDER_VALIDATION", "FINAL_LAUNCH"].map(
      (type) => ({ approvalType: type, decision: "APPROVED", planHash: hash }),
    );
    expect(evaluateLaunchApprovals(approvals, hash).complete).toBe(true);
  });

  it("detects stale approval after plan change", () => {
    const result = evaluateLaunchApprovals(
      [{ approvalType: "CAMPAIGN", decision: "APPROVED", planHash: "old" }],
      "new",
    );
    expect(result.stale).toContain("CAMPAIGN");
  });
});

describe("budget safety", () => {
  it("blocks excessive budget increase", () => {
    const result = evaluateBudgetGuardrails({
      approvedDailyBudgetCents: 10000,
      proposedDailyBudgetCents: 15000,
      currency: "USD",
      accountCurrency: "USD",
    });
    expect(result.allowed).toBe(false);
  });
});

describe("error recovery", () => {
  it("classifies token expiry", () => {
    expect(classifyLinkedInLaunchError(new Error("token expired")).requiresReauth).toBe(true);
  });

  it("classifies policy rejection", () => {
    expect(classifyLinkedInLaunchError(new Error("policy rejected")).requiresReapproval).toBe(true);
  });
});

describe("adapter contract", () => {
  it("implements provider identifier", () => {
    expect(linkedInAdsAdapter.provider).toBe("LINKEDIN");
  });

  it("validates draft via adapter", () => {
    const draft = mapPlanToLinkedInAdsDraft(samplePlan);
    expect(linkedInAdsAdapter.validateDraft(draft).valid).toBe(true);
  });
});

describe("permissions", () => {
  it("grants launch to admin", () => {
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["advertisingLinkedInAds.launch"])).toBe(true);
  });

  it("denies launch to viewer", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["advertisingLinkedInAds.launch"])).toBe(false);
  });
});

describe("tenant isolation", () => {
  it("draft payload does not embed tenant IDs", () => {
    const draft = mapPlanToLinkedInAdsDraft(samplePlan);
    const json = JSON.stringify(draft);
    expect(json).not.toContain("organisationId");
    expect(json).not.toContain("brandId");
  });
});

describe("local validation disclaimer", () => {
  it("includes non-guarantee disclaimer", () => {
    const draft = mapPlanToLinkedInAdsDraft(samplePlan);
    expect(validateLinkedInAdsDraft(draft).disclaimer).toContain("does not guarantee");
  });
});
