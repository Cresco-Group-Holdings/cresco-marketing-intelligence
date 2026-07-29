import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";

const growthIntelligenceService = vi.hoisted(() => ({
  getSummary: vi.fn(),
  analyze: vi.fn(),
  listInsights: vi.fn(),
  getInsight: vi.fn(),
  listBenchmarks: vi.fn(),
  listPatterns: vi.fn(),
}));
const growthRecommendationService = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  recordFeedback: vi.fn(),
  explainWithAi: vi.fn(),
  explainInsightWithAi: vi.fn(),
  createDraft: vi.fn(),
  listExperiments: vi.fn(),
  updateExperiment: vi.fn(),
}));
const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/growth-intelligence-service", () => ({
  growthIntelligenceService,
}));
vi.mock("@/server/services/growth-recommendation-service", () => ({
  growthRecommendationService,
}));
vi.mock("@/lib/tenancy/guards", () => ({
  buildTenantContext,
}));
vi.mock("@/lib/auth/provisioning", () => ({
  ensureUserProfile: vi.fn(async () => ({
    authUserId: "growth-route-user",
    email: "growth-route@example.test",
    userProfileId: "profile-growth",
  })),
  extractProviderMetadata: vi.fn(() => ({})),
}));

import { GET as getGrowth, POST as postGrowth } from "@/app/api/brands/[brandId]/growth/route";
import { GET as getInsights } from "@/app/api/brands/[brandId]/growth/insights/route";
import { GET as getInsight, POST as postInsight } from "@/app/api/brands/[brandId]/growth/insights/[insightId]/route";
import { GET as getRecommendations } from "@/app/api/brands/[brandId]/growth/recommendations/route";
import {
  GET as getRecommendation,
  POST as postRecommendation,
} from "@/app/api/brands/[brandId]/growth/recommendations/[recommendationId]/route";
import { GET as getExperiments } from "@/app/api/brands/[brandId]/growth/experiments/route";
import { GET as getBaselines } from "@/app/api/brands/[brandId]/growth/baselines/route";
import { buildTenantContext as importedBuildTenantContext } from "@/lib/tenancy/guards";

const originalAuth = process.env.ALLOW_TEST_AUTH;
const originalUser = process.env.TEST_AUTH_USER_ID;

function request(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`https://app.test${path}`, init);
}

describe("growth API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOW_TEST_AUTH = "true";
    process.env.TEST_AUTH_USER_ID = "growth-route-user";
    process.env.TEST_AUTH_EMAIL = "growth-route@example.test";
    buildTenantContext.mockResolvedValue({
      userId: "growth-route-user",
      userProfileId: "profile-growth",
      organisationId: "org-growth",
      organisationRole: OrganisationRole.OWNER,
    });
    growthIntelligenceService.getSummary.mockResolvedValue({ activeRecommendations: 1 });
    growthIntelligenceService.analyze.mockResolvedValue({ insightCount: 12 });
    growthIntelligenceService.listInsights.mockResolvedValue([]);
    growthIntelligenceService.getInsight.mockResolvedValue({ id: "insight-1" });
    growthIntelligenceService.listBenchmarks.mockResolvedValue([]);
    growthIntelligenceService.listPatterns.mockResolvedValue([]);
    growthRecommendationService.list.mockResolvedValue([]);
    growthRecommendationService.getById.mockResolvedValue({ id: "rec-1" });
    growthRecommendationService.recordFeedback.mockResolvedValue({ id: "rec-1" });
    growthRecommendationService.explainWithAi.mockResolvedValue({ id: "rec-1" });
    growthRecommendationService.explainInsightWithAi.mockResolvedValue({ insightId: "insight-1" });
    growthRecommendationService.createDraft.mockResolvedValue({ contentItemId: "content-1" });
    growthRecommendationService.listExperiments.mockResolvedValue([]);
  });

  afterEach(() => {
    process.env.ALLOW_TEST_AUTH = originalAuth;
    process.env.TEST_AUTH_USER_ID = originalUser;
  });

  it("rejects requests without organisation context", async () => {
    const response = await getGrowth(request("/api/brands/brand-1/growth"), {
      params: Promise.resolve({ brandId: "brand-1" }),
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("TENANT_CONTEXT_REQUIRED");
  });

  it("authorises growth read and generate routes for the tenant", async () => {
    const query =
      "organisationId=org-growth&from=2026-07-01T00:00:00.000Z&to=2026-07-31T23:59:59.999Z";
    const summary = await getGrowth(
      request(`/api/brands/brand-1/growth?organisationId=org-growth`),
      { params: Promise.resolve({ brandId: "brand-1" }) },
    );
    expect(summary.status).toBe(200);

    const analyze = await postGrowth(request(`/api/brands/brand-1/growth?${query}`, { method: "POST" }), {
      params: Promise.resolve({ brandId: "brand-1" }),
    });
    expect(analyze.status).toBe(200);
    expect(growthIntelligenceService.analyze).toHaveBeenCalled();
    expect(importedBuildTenantContext).toHaveBeenCalledWith(
      expect.objectContaining({ organisationId: "org-growth" }),
    );
  });

  it("returns forbidden when the tenant role lacks growth permissions", async () => {
    buildTenantContext.mockResolvedValueOnce({
      userId: "growth-route-user",
      userProfileId: "profile-growth",
      organisationId: "org-growth",
      organisationRole: OrganisationRole.VIEWER,
    });
    const response = await getGrowth(
      request("/api/brands/brand-1/growth?organisationId=org-growth"),
      { params: Promise.resolve({ brandId: "brand-1" }) },
    );
    expect(response.status).toBe(403);
  });

  it("routes insight, recommendation, experiment, and baseline reads", async () => {
    const org = "organisationId=org-growth";
    const routes = [
      getInsights(request(`/api/brands/brand-1/growth/insights?${org}`), {
        params: Promise.resolve({ brandId: "brand-1" }),
      }),
      getInsight(request(`/api/brands/brand-1/growth/insights/insight-1?${org}`), {
        params: Promise.resolve({ brandId: "brand-1", insightId: "insight-1" }),
      }),
      getRecommendations(request(`/api/brands/brand-1/growth/recommendations?${org}`), {
        params: Promise.resolve({ brandId: "brand-1" }),
      }),
      getRecommendation(request(`/api/brands/brand-1/growth/recommendations/rec-1?${org}`), {
        params: Promise.resolve({ brandId: "brand-1", recommendationId: "rec-1" }),
      }),
      getExperiments(request(`/api/brands/brand-1/growth/experiments?${org}`), {
        params: Promise.resolve({ brandId: "brand-1" }),
      }),
      getBaselines(request(`/api/brands/brand-1/growth/baselines?${org}`), {
        params: Promise.resolve({ brandId: "brand-1" }),
      }),
    ];
    for (const response of await Promise.all(routes)) {
      expect(response.status).toBe(200);
    }
  });

  it("returns not found for invalid recommendation IDs", async () => {
    growthRecommendationService.getById.mockResolvedValueOnce(null);
    const response = await getRecommendation(
      request("/api/brands/brand-1/growth/recommendations/missing?organisationId=org-growth"),
      { params: Promise.resolve({ brandId: "brand-1", recommendationId: "missing" }) },
    );
    expect(response.status).toBe(404);
  });

  it("routes explain, feedback, and draft actions", async () => {
    const org = "organisationId=org-growth";
    const explain = await postRecommendation(
      request(`/api/brands/brand-1/growth/recommendations/rec-1?${org}&action=explain`, {
        method: "POST",
      }),
      { params: Promise.resolve({ brandId: "brand-1", recommendationId: "rec-1" }) },
    );
    expect(explain.status).toBe(200);

    const insightExplain = await postInsight(
      request(`/api/brands/brand-1/growth/insights/insight-1?${org}&action=explain`, {
        method: "POST",
      }),
      { params: Promise.resolve({ brandId: "brand-1", insightId: "insight-1" }) },
    );
    expect(insightExplain.status).toBe(200);

    const feedback = await postRecommendation(
      request(`/api/brands/brand-1/growth/recommendations/rec-1?${org}`, {
        method: "POST",
        body: JSON.stringify({ feedbackStatus: "ACCEPTED" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ brandId: "brand-1", recommendationId: "rec-1" }) },
    );
    expect(feedback.status).toBe(200);

    const draft = await postRecommendation(
      request(`/api/brands/brand-1/growth/recommendations/rec-1?${org}&action=draft`, {
        method: "POST",
        body: JSON.stringify({ draftType: "CALENDAR_PLACEHOLDER", socialAccountId: "acct-1" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ brandId: "brand-1", recommendationId: "rec-1" }) },
    );
    expect(draft.status).toBe(200);
    expect(growthRecommendationService.createDraft).toHaveBeenCalled();
  });
});
