import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { evaluateBudgetGuardrails } from "@/lib/advertising-meta-ads/budget-guardrails";
import { buildCapiEventId, buildCapiPayload, hashForMeta, shouldSkipCapi } from "@/lib/advertising-meta-ads/capi";
import { validateMetaCreative } from "@/lib/advertising-meta-ads/creative-validation";
import { mapPlanToMetaAdsDraft } from "@/lib/advertising-meta-ads/draft-mapper";
import { classifyMetaLaunchError } from "@/lib/advertising-meta-ads/error-recovery";
import { buildLaunchIdempotencyKey } from "@/lib/advertising-meta-ads/idempotency";
import { evaluateLaunchApprovals } from "@/lib/advertising-meta-ads/launch-approval";
import { buildMutationOperations, hashMutationPlan } from "@/lib/advertising-meta-ads/mutation-plan";
import { translatePlanObjective } from "@/lib/advertising-meta-ads/objective-mapper";
import { validateTargetingPolicy } from "@/lib/advertising-meta-ads/targeting-policy";
import { validateMetaAdsDraftLocally } from "@/lib/advertising-meta-ads/validation";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const samplePlan = {
  planId: "plan_1",
  planName: "Meta Lead Gen",
  internalCampaignId: "BRAND_META_LEAD",
  primaryObjective: "LEAD_GENERATION",
  reportingCurrency: "USD",
  channels: [{ channelType: "META_FACEBOOK" }, { channelType: "META_INSTAGRAM" }],
  budgets: [{ budgetType: "DAILY", currency: "USD", amount: 75 }],
  destinations: [{ destinationUrl: "https://example.com/landing" }],
  creatives: [{ format: "FEED", headline: "Get started", description: "Learn more today." }],
};

const assets = {
  facebookPageId: "123456",
  instagramAccountId: "789",
  pixelId: "pixel_1",
};

describe("objective mapping", () => {
  it("translates lead generation to Meta outcome", () => {
    const result = translatePlanObjective("LEAD_GENERATION");
    expect(result.metaObjective).toBe("OUTCOME_LEADS");
    expect(result.supported).toBe(true);
  });

  it("maps traffic objective", () => {
    expect(translatePlanObjective("WEBSITE_TRAFFIC").metaObjective).toBe("OUTCOME_TRAFFIC");
  });
});

describe("targeting policy", () => {
  it("allows approved country targeting", () => {
    const result = validateTargetingPolicy({ countries: ["US"], ageMin: 18, ageMax: 65 });
    expect(result.allowed).toBe(true);
  });

  it("blocks age below policy minimum", () => {
    const result = validateTargetingPolicy({ countries: ["US"], ageMin: 16 });
    expect(result.allowed).toBe(false);
  });

  it("prevents prohibited sensitive targeting", () => {
    const result = validateTargetingPolicy({
      countries: ["US"],
      interests: ["health_conditions"],
    });
    expect(result.allowed).toBe(false);
  });
});

describe("draft mapper", () => {
  it("maps plan to campaign ad set ad creative hierarchy", () => {
    const draft = mapPlanToMetaAdsDraft(samplePlan, assets);
    expect(draft.campaign.status).toBe("PAUSED");
    expect(draft.adSet.publisher_platforms).toContain("facebook");
    expect(draft.adSet.publisher_platforms).toContain("instagram");
    expect(draft.creative.format).toBe("FEED");
    expect(draft.assets.facebook_page_id).toBe("123456");
  });

  it("requires Meta channel", () => {
    expect(() => mapPlanToMetaAdsDraft({ ...samplePlan, channels: [{ channelType: "GOOGLE_SEARCH" }] }, assets)).toThrow();
  });
});

describe("mutation plan", () => {
  it("hashes operations deterministically", () => {
    const draft = mapPlanToMetaAdsDraft(samplePlan, assets);
    const preview = buildMutationOperations(draft, { adAccountId: "act_123" });
    expect(hashMutationPlan(preview.operations)).toHaveLength(64);
  });

  it("builds idempotency key", () => {
    const key = buildLaunchIdempotencyKey("p1", "hash", 1);
    expect(key).toHaveLength(64);
  });
});

describe("creative validation", () => {
  it("requires Facebook Page", () => {
    const result = validateMetaCreative({
      format: "FEED",
      primaryText: "Hello",
      headline: "Title",
      destinationUrl: "https://example.com",
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "MISSING_PAGE")).toBe(true);
  });

  it("detects Instagram mismatch", () => {
    const result = validateMetaCreative({
      format: "REEL",
      primaryText: "Hello",
      headline: "Title",
      destinationUrl: "https://example.com",
      facebookPageId: "123",
      placement: "instagram",
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "INSTAGRAM_MISMATCH")).toBe(true);
  });
});

describe("local validation disclaimer", () => {
  it("includes local-only warning", () => {
    const draft = mapPlanToMetaAdsDraft(samplePlan, assets);
    const result = validateMetaAdsDraftLocally(draft);
    expect(result.localOnly).toBe(true);
    expect(result.issues.some((i) => i.code === "LOCAL_VALIDATION_ONLY")).toBe(true);
  });
});

describe("launch approvals", () => {
  it("requires all gates", () => {
    const result = evaluateLaunchApprovals([], "hash1");
    expect(result.complete).toBe(false);
    expect(result.pending.length).toBe(8);
  });

  it("detects stale hash", () => {
    const approvals = Array.from({ length: 8 }, (_, i) => ({
      approvalType: ["CAMPAIGN", "CREATIVE", "COMPLIANCE", "BUDGET", "CONVERSION", "ACCOUNT_PERMISSION", "PROVIDER_VALIDATION", "FINAL_LAUNCH"][i],
      decision: "APPROVED",
      planHash: "old",
    }));
    const result = evaluateLaunchApprovals(approvals, "new");
    expect(result.stale.length).toBe(8);
  });
});

describe("budget guardrails", () => {
  it("blocks AI-suggested changes", () => {
    const result = evaluateBudgetGuardrails({
      proposedDailyCents: 5000,
      approvedMaxDailyCents: 10000,
      accountCurrency: "USD",
      planCurrency: "USD",
      isAiSuggested: true,
    });
    expect(result.allowed).toBe(false);
  });

  it("blocks currency mismatch", () => {
    const result = evaluateBudgetGuardrails({
      proposedDailyCents: 5000,
      approvedMaxDailyCents: 10000,
      accountCurrency: "EUR",
      planCurrency: "USD",
    });
    expect(result.allowed).toBe(false);
  });
});

describe("CAPI deduplication", () => {
  it("skips without consent", () => {
    expect(shouldSkipCapi("DENIED")).toBe(true);
    const payload = buildCapiPayload(
      { eventName: "Purchase", eventTime: new Date(), consentState: "DENIED" },
      "e1",
    );
    expect(payload).toBeNull();
  });

  it("hashes PII for Meta", () => {
    const hash = hashForMeta("Test@Example.com");
    expect(hash).toHaveLength(64);
  });

  it("builds stable event id with browser dedup", () => {
    const t = new Date("2026-07-30T12:00:00Z");
    const id1 = buildCapiEventId({ eventName: "Lead", browserEventId: "browser-1", eventTime: t });
    const id2 = buildCapiEventId({ eventName: "Lead", browserEventId: "browser-1", eventTime: t });
    expect(id1).toBe(id2);
  });
});

describe("error recovery", () => {
  it("classifies Instagram mismatch", () => {
    const err = classifyMetaLaunchError({ message: "IG_ACCOUNT mismatch" });
    expect(err.kind).toBe("INSTAGRAM_MISMATCH");
  });

  it("classifies policy rejection", () => {
    const err = classifyMetaLaunchError({ policyRejected: true });
    expect(err.kind).toBe("POLICY_REJECTION");
  });

  it("classifies rate limit", () => {
    const err = classifyMetaLaunchError({ code: "17" });
    expect(err.kind).toBe("RATE_LIMIT");
    expect(err.retryable).toBe(true);
  });
});

describe("permissions", () => {
  it("grants launch to admin only", () => {
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["advertisingMetaAds.launch"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["advertisingMetaAds.launch"])).toBe(false);
  });

  it("allows read for viewer", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["advertisingMetaAds.read"])).toBe(true);
  });
});

describe("tenant isolation", () => {
  it("does not embed tenant ids in draft payload", () => {
    const draft = mapPlanToMetaAdsDraft(samplePlan, assets);
    const json = JSON.stringify(draft);
    expect(json).not.toContain("organisationId");
    expect(json).not.toContain("brandId");
  });
});
