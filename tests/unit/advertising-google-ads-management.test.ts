import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { currencyToMicros, evaluateBudgetGuardrails, microsToCurrency } from "@/lib/advertising-google-ads/budget-guardrails";
import { REQUIRED_LAUNCH_APPROVAL_TYPES, SUPPORTED_CAMPAIGN_TYPES } from "@/lib/advertising-google-ads/constants";
import { mapPlanToGoogleAdsDraft, isSearchCampaignSupported } from "@/lib/advertising-google-ads/draft-mapper";
import { classifyLaunchError, shouldUseIdempotentRetry } from "@/lib/advertising-google-ads/error-recovery";
import { buildLaunchIdempotencyKey } from "@/lib/advertising-google-ads/idempotency";
import { evaluateLaunchApprovals, invalidateApprovalsOnMaterialChange } from "@/lib/advertising-google-ads/launch-approval";
import { buildMutationOperations, hashMutationPlan, planHashMatches } from "@/lib/advertising-google-ads/mutation-plan";
import { validateGoogleAdsDraftLocally } from "@/lib/advertising-google-ads/validation";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const samplePlanInput = {
  planId: "plan_1",
  planName: "Q3 Lead Gen",
  internalCampaignId: "BRAND_GGL_LEAD_US_202607",
  reportingCurrency: "USD",
  channels: [{ channelType: "GOOGLE_SEARCH", provider: "GOOGLE_ADS" }],
  budgets: [{ budgetType: "DAILY", currency: "USD", amount: 50 }],
  destinations: [{ destinationUrl: "https://example.com/landing" }],
  conversionGoals: [{ isPrimary: true, trackingVerified: true }],
  creatives: [{ format: "RESPONSIVE_SEARCH_AD", headlines: ["H1", "H2", "H3"], descriptions: ["D1", "D2"] }],
  keywords: [{ text: "marketing software", matchType: "PHRASE" as const }],
};

describe("Google Ads draft mapper", () => {
  it("maps approved plan to search draft without mutations", () => {
    const draft = mapPlanToGoogleAdsDraft(samplePlanInput);
    expect(draft.campaign.advertisingChannelType).toBe("SEARCH");
    expect(draft.campaign.status).toBe("PAUSED");
    expect(draft.adGroups[0].ads[0].type).toBe("RESPONSIVE_SEARCH_AD");
  });

  it("requires GOOGLE_SEARCH channel", () => {
    expect(() =>
      mapPlanToGoogleAdsDraft({ ...samplePlanInput, channels: [{ channelType: "META_FACEBOOK" }] }),
    ).toThrow();
  });

  it("supports search campaign type only in initial scope", () => {
    expect(SUPPORTED_CAMPAIGN_TYPES).toEqual(["SEARCH"]);
    expect(isSearchCampaignSupported(["GOOGLE_SEARCH"])).toBe(true);
  });
});

describe("mutation plan hashing", () => {
  it("produces stable hash for identical operations", () => {
    const draft = mapPlanToGoogleAdsDraft(samplePlanInput);
    const preview = buildMutationOperations(draft, { customerId: "1234567890", currency: "USD" });
    const hash1 = hashMutationPlan(preview.operations);
    const hash2 = hashMutationPlan(preview.operations);
    expect(hash1).toBe(hash2);
    expect(planHashMatches(hash1, preview.operations)).toBe(true);
  });

  it("changes hash when operations change", () => {
    const draft = mapPlanToGoogleAdsDraft(samplePlanInput);
    const preview = buildMutationOperations(draft, { customerId: "1234567890" });
    const hash1 = hashMutationPlan(preview.operations);
    const modified = [...preview.operations];
    modified[0] = {
      ...modified[0],
      payload: { ...modified[0].payload, amountMicros: 99_000_000 },
    };
    expect(hashMutationPlan(modified)).not.toBe(hash1);
  });

  it("builds idempotency key from plan and hash", () => {
    const key = buildLaunchIdempotencyKey("plan1", "abc123", 1);
    expect(key).toHaveLength(64);
    expect(buildLaunchIdempotencyKey("plan1", "abc123", 1)).toBe(key);
  });
});

describe("launch approval gates", () => {
  it("requires all approval types", () => {
    expect(REQUIRED_LAUNCH_APPROVAL_TYPES).toContain("FINAL_LAUNCH");
    expect(REQUIRED_LAUNCH_APPROVAL_TYPES).toContain("BUDGET");
  });

  it("detects incomplete approvals", () => {
    const result = evaluateLaunchApprovals([], "hash1");
    expect(result.complete).toBe(false);
    expect(result.pending.length).toBe(REQUIRED_LAUNCH_APPROVAL_TYPES.length);
  });

  it("detects stale approvals after hash change", () => {
    const result = evaluateLaunchApprovals(
      REQUIRED_LAUNCH_APPROVAL_TYPES.map((t) => ({ approvalType: t, decision: "APPROVED", planHash: "old" })),
      "new",
    );
    expect(result.complete).toBe(false);
    expect(result.stale.length).toBe(REQUIRED_LAUNCH_APPROVAL_TYPES.length);
  });

  it("invalidates approvals on material change", () => {
    const updated = invalidateApprovalsOnMaterialChange(
      "old",
      "new",
      [{ approvalType: "BUDGET", decision: "APPROVED", planHash: "old" }],
    );
    expect(updated[0].decision).toBe("STALE");
  });
});

describe("local validation", () => {
  it("rejects draft without enough RSA headlines", () => {
    const draft = mapPlanToGoogleAdsDraft({
      ...samplePlanInput,
      creatives: [{ format: "RSA", headlines: ["Only one"], descriptions: ["D1", "D2"] }],
    });
    draft.adGroups[0].ads[0].headlines = ["Only one"];
    const result = validateGoogleAdsDraftLocally(draft);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "INSUFFICIENT_HEADLINES")).toBe(true);
  });

  it("passes valid search draft", () => {
    const draft = mapPlanToGoogleAdsDraft(samplePlanInput);
    const result = validateGoogleAdsDraftLocally(draft);
    expect(result.valid).toBe(true);
  });
});

describe("budget guardrails", () => {
  it("blocks budget above approved maximum", () => {
    const result = evaluateBudgetGuardrails({
      proposedDailyMicros: currencyToMicros(200),
      approvedMaxDailyMicros: currencyToMicros(100),
      accountCurrency: "USD",
      planCurrency: "USD",
    });
    expect(result.allowed).toBe(false);
  });

  it("blocks AI-suggested budget changes", () => {
    const result = evaluateBudgetGuardrails({
      proposedDailyMicros: currencyToMicros(50),
      approvedMaxDailyMicros: currencyToMicros(100),
      accountCurrency: "USD",
      planCurrency: "USD",
      isAiSuggested: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.includes("AI"))).toBe(true);
  });

  it("blocks currency mismatch", () => {
    const result = evaluateBudgetGuardrails({
      proposedDailyMicros: currencyToMicros(50),
      approvedMaxDailyMicros: currencyToMicros(100),
      accountCurrency: "EUR",
      planCurrency: "USD",
    });
    expect(result.allowed).toBe(false);
  });

  it("converts micros correctly", () => {
    expect(microsToCurrency(1_500_000)).toBe(1.5);
  });
});

describe("error recovery", () => {
  it("classifies stale approval", () => {
    const action = classifyLaunchError({ staleApproval: true });
    expect(action.kind).toBe("STALE_APPROVAL");
    expect(action.requiresReapproval).toBe(true);
  });

  it("classifies duplicate retry", () => {
    const action = classifyLaunchError({ duplicateResource: true });
    expect(action.kind).toBe("DUPLICATE_RETRY");
  });

  it("allows idempotent retry after timeout when resources exist", () => {
    const action = classifyLaunchError({ code: "TIMEOUT" });
    expect(shouldUseIdempotentRetry(2, action)).toBe(true);
  });
});

describe("permissions", () => {
  it("grants launch permission to admin", () => {
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["advertisingGoogleAds.launch"])).toBe(true);
  });

  it("denies launch to viewer", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["advertisingGoogleAds.launch"])).toBe(false);
  });

  it("allows read-only roles to view google ads", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["advertisingGoogleAds.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.ANALYST, PERMISSIONS["advertisingGoogleAds.read"])).toBe(true);
  });

  it("does not allow marketers to launch without explicit permission", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["advertisingGoogleAds.launch"])).toBe(false);
  });
});

describe("tenant isolation guards", () => {
  it("does not expose arbitrary database fields in draft mapper", () => {
    const draft = mapPlanToGoogleAdsDraft(samplePlanInput);
    expect(JSON.stringify(draft)).not.toContain("userId");
    expect(JSON.stringify(draft)).not.toContain("organisationId");
  });
});
