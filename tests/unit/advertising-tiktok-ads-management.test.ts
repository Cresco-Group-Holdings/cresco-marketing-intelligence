import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { tikTokAdsAdapter } from "@/lib/advertising-tiktok-ads/adapter";
import { evaluateBudgetGuardrails } from "@/lib/advertising-tiktok-ads/budget-guardrails";
import { validateTikTokCreative } from "@/lib/advertising-tiktok-ads/creative-validation";
import { mapPlanToTikTokAdsDraft } from "@/lib/advertising-tiktok-ads/draft-mapper";
import { classifyTikTokLaunchError } from "@/lib/advertising-tiktok-ads/error-recovery";
import { buildLaunchIdempotencyKey } from "@/lib/advertising-tiktok-ads/idempotency";
import { evaluateLaunchApprovals } from "@/lib/advertising-tiktok-ads/launch-approval";
import { buildMutationOperations, hashMutationPlan, materialChangeInvalidatesApproval } from "@/lib/advertising-tiktok-ads/mutation-plan";
import { translatePlanObjective } from "@/lib/advertising-tiktok-ads/objective-mapper";
import { validateTargetingPolicy } from "@/lib/advertising-tiktok-ads/targeting-policy";
import { validateTikTokAdsDraft } from "@/lib/advertising-tiktok-ads/validation";
import { isCapabilityAvailable, TIKTOK_ADS_CAPABILITIES } from "@/lib/advertising-providers/capability-gates";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const samplePlan = {
  planId: "plan_tt",
  planName: "TikTok Traffic",
  internalCampaignId: "BRAND_TT_TRAFFIC",
  primaryObjective: "WEBSITE_TRAFFIC",
  reportingCurrency: "USD",
  channels: [{ channelType: "TIKTOK" }],
  budgets: [{ budgetType: "DAILY", currency: "USD", amount: 80 }],
  destinations: [{ destinationUrl: "https://example.com/landing" }],
  creatives: [{ format: "SHORT_VIDEO", headline: "Watch now", description: "Learn more." }],
};

describe("capability gates", () => {
  it("enables traffic objective", () => {
    expect(isCapabilityAvailable(TIKTOK_ADS_CAPABILITIES, "traffic")).toBe(true);
  });

  it("disables spark ads without authorisation", () => {
    expect(isCapabilityAvailable(TIKTOK_ADS_CAPABILITIES, "spark_ads")).toBe(false);
  });
});

describe("objective mapping", () => {
  it("translates traffic objective", () => {
    expect(translatePlanObjective("WEBSITE_TRAFFIC").tiktokObjective).toBe("TRAFFIC");
  });

  it("flags unsupported objective", () => {
    expect(translatePlanObjective("BRAND_AWARENESS").supported).toBe(false);
  });
});

describe("targeting policy", () => {
  it("allows broad audience", () => {
    expect(validateTargetingPolicy({ broad: true }).allowed).toBe(true);
  });

  it("blocks age below minimum", () => {
    expect(validateTargetingPolicy({ countries: ["US"], ageMin: 16 }).allowed).toBe(false);
  });
});

describe("creative validation", () => {
  it("rejects spark ads simulation", () => {
    const result = validateTikTokCreative({
      format: "SHORT_VIDEO",
      adText: "Hello",
      destinationUrl: "https://example.com",
      sparkAdAuthorized: true,
    });
    expect(result.valid).toBe(false);
  });
});

describe("draft mapper", () => {
  it("maps plan to campaign ad group ad hierarchy", () => {
    const draft = mapPlanToTikTokAdsDraft(samplePlan, {});
    expect(draft.campaign.status).toBe("DISABLE");
    expect(draft.adGroup.placementType).toBe("PLACEMENT_TYPE_AUTOMATIC");
  });

  it("requires TikTok channel", () => {
    expect(() => mapPlanToTikTokAdsDraft({ ...samplePlan, channels: [{ channelType: "META_FACEBOOK" }] }, {})).toThrow();
  });
});

describe("mutation plan", () => {
  it("hashes operations deterministically", () => {
    const draft = mapPlanToTikTokAdsDraft(samplePlan, {});
    const preview = buildMutationOperations(draft, { advertiserId: "123" });
    expect(hashMutationPlan(preview.operations)).toHaveLength(64);
  });

  it("invalidates approval on audience change", () => {
    expect(materialChangeInvalidatesApproval(["audience"])).toBe(true);
  });

  it("builds idempotent launch key", () => {
    expect(buildLaunchIdempotencyKey("p1", "hash", 1)).toHaveLength(64);
  });
});

describe("exact-plan approval", () => {
  it("requires complete gates", () => {
    const hash = "def456";
    const incomplete = evaluateLaunchApprovals([], hash);
    expect(incomplete.complete).toBe(false);
    expect(incomplete.pending.length).toBeGreaterThan(0);
  });
});

describe("budget safety", () => {
  it("enforces currency match", () => {
    const result = evaluateBudgetGuardrails({
      approvedDailyBudgetCents: 5000,
      proposedDailyBudgetCents: 5500,
      currency: "EUR",
      accountCurrency: "USD",
    });
    expect(result.allowed).toBe(false);
  });
});

describe("error recovery", () => {
  it("classifies partial failure as retryable timeout", () => {
    expect(classifyTikTokLaunchError(new Error("request timeout")).retryable).toBe(true);
  });

  it("classifies account suspension", () => {
    expect(classifyTikTokLaunchError(new Error("account suspended")).recoverable).toBe(false);
  });
});

describe("adapter contract", () => {
  it("implements provider identifier", () => {
    expect(tikTokAdsAdapter.provider).toBe("TIKTOK");
  });
});

describe("permissions", () => {
  it("grants draft to marketer", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["advertisingTikTokAds.draft"])).toBe(true);
  });

  it("denies manage to analyst", () => {
    expect(hasPermission(OrganisationRole.ANALYST, PERMISSIONS["advertisingTikTokAds.manage"])).toBe(false);
  });
});

describe("tenant isolation", () => {
  it("draft payload does not embed tenant IDs", () => {
    const json = JSON.stringify(mapPlanToTikTokAdsDraft(samplePlan, {}));
    expect(json).not.toContain("organisationId");
    expect(json).not.toContain("brandId");
  });
});

describe("provider-disabled states", () => {
  it("validation includes disclaimer", () => {
    const draft = mapPlanToTikTokAdsDraft(samplePlan, {});
    expect(validateTikTokAdsDraft(draft).disclaimer).toContain("does not guarantee");
  });
});
