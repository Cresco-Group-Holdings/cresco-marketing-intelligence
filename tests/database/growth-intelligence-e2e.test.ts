import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole, Prisma } from "@prisma/client";
import {
  createGrowthOffer,
  growthAnalysisFilters,
  seedGrowthMetrics,
} from "./helpers/growth-fixtures";
import {
  createTenant,
  databaseSuiteEnabled,
  prisma,
  resetDatabase,
  type Tenant,
} from "./helpers/analytics-fixtures";
import { aiRequestService } from "@/server/services/ai-request-service";
import { growthExplanationService } from "@/server/services/growth-explanation-service";
import { brandContextBuilder } from "@/lib/ai/brand-context-builder";
import { GET as getGrowth } from "@/app/api/brands/[brandId]/growth/route";
import { AppError } from "@/lib/errors";

const suite = databaseSuiteEnabled ? describe : describe.skip;

function growthRequest(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`https://app.test${path}`, init);
}

suite("growth intelligence against a real database", () => {
  let tenant: Tenant;
  let offer: { id: string; name: string };

  beforeEach(async () => {
    vi.unstubAllGlobals();
    process.env.ALLOW_TEST_AUTH = "true";
    process.env.TEST_AUTH_USER_ID = "growth-db-user";
    process.env.TEST_AUTH_EMAIL = "growth-db@example.test";
    await resetDatabase();
    tenant = await createTenant({ analyticsTimezone: "UTC" });
    offer = await createGrowthOffer(tenant);

    const educationPosts = Array.from({ length: 3 }, (_, index) => ({
      providerPostId: `edu-post-${index}`,
      contentItemId: tenant.contentItem.id,
      publishedAt: new Date(`2026-07-${10 + index}T10:00:00Z`),
      topic: "Grant readiness",
      offerId: offer.id,
      metrics: {
        impressions: 1000,
        likes: 200,
        comments: 40,
        shares: 10,
        saves: 5,
        reach: 900,
        clicks: 30,
      },
    }));

    const fillerPosts = Array.from({ length: 5 }, (_, index) => ({
      providerPostId: `news-post-${index}`,
      contentItemId: tenant.contentItem.id,
      publishedAt: new Date(`2026-07-${12 + index}T12:00:00Z`),
      topic: "Industry news",
      metrics: {
        impressions: 1000,
        likes: 5,
        comments: 1,
        shares: 0,
        saves: 0,
        reach: 800,
        clicks: 2,
      },
    }));

    await seedGrowthMetrics(tenant, [...educationPosts, ...fillerPosts]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function growthServices() {
    const intelligence = await import("@/server/services/growth-intelligence-service");
    const recommendations = await import("@/server/services/growth-recommendation-service");
    return {
      growthIntelligenceService: intelligence.growthIntelligenceService,
      growthRecommendationService: recommendations.growthRecommendationService,
    };
  }

  it("runs atomic analysis, persists evidence, and stays idempotent on rerun", async () => {
    const { growthIntelligenceService } = await growthServices();
    const filters = growthAnalysisFilters(30);
    const first = await growthIntelligenceService.analyze(
      tenant.brand.id,
      tenant.organisation.id,
      filters,
      tenant.context as never,
      { force: true },
    );

    expect(first.insightCount).toBe(12);
    expect(first.recommendations.length).toBeGreaterThan(0);

    const activeInsights = await prisma.growthInsight.count({
      where: {
        organisationId: tenant.organisation.id,
        brandId: tenant.brand.id,
        supersededAt: null,
      },
    });
    const activeRecommendations = await prisma.growthRecommendation.count({
      where: {
        organisationId: tenant.organisation.id,
        brandId: tenant.brand.id,
        status: "ACTIVE",
      },
    });
    expect(activeInsights).toBe(12);
    expect(activeRecommendations).toBeGreaterThan(0);

    const evidenceCount = await prisma.insightEvidence.count({
      where: { organisationId: tenant.organisation.id, brandId: tenant.brand.id },
    });
    expect(evidenceCount).toBeGreaterThan(0);

    const cached = await growthIntelligenceService.analyze(
      tenant.brand.id,
      tenant.organisation.id,
      filters,
      tenant.context as never,
    );
    expect(cached.cached).toBe(true);
    expect(
      await prisma.growthRecommendation.count({
        where: {
          organisationId: tenant.organisation.id,
          brandId: tenant.brand.id,
          status: "ACTIVE",
        },
      }),
    ).toBe(activeRecommendations);
  });

  it("rolls back superseded state when the analysis transaction fails", async () => {
    const previousFailure = process.env.GROWTH_TEST_FAILURE_POINT;
    process.env.GROWTH_TEST_FAILURE_POINT = "before_complete";
    const { growthIntelligenceService } = await growthServices();
    const beforeInsights = await prisma.growthInsight.count({
      where: { brandId: tenant.brand.id, supersededAt: null },
    });

    await expect(
      growthIntelligenceService.analyze(
        tenant.brand.id,
        tenant.organisation.id,
        growthAnalysisFilters(30),
        tenant.context as never,
        { force: true },
      ),
    ).rejects.toThrow();

    const afterInsights = await prisma.growthInsight.count({
      where: { brandId: tenant.brand.id, supersededAt: null },
    });
    expect(afterInsights).toBe(beforeInsights);
    process.env.GROWTH_TEST_FAILURE_POINT = previousFailure;
  });

  it("denies cross-organisation and cross-brand access", async () => {
    const otherTenant = await createTenant();
    const { growthIntelligenceService, growthRecommendationService } = await growthServices();
    const filters = growthAnalysisFilters(30);
    await growthIntelligenceService.analyze(
      tenant.brand.id,
      tenant.organisation.id,
      filters,
      tenant.context as never,
      { force: true },
    );

    const recommendation = await prisma.growthRecommendation.findFirst({
      where: { brandId: tenant.brand.id, status: "ACTIVE" },
    });
    expect(recommendation).toBeTruthy();

    await expect(
      growthIntelligenceService.getInsight(
        tenant.brand.id,
        otherTenant.organisation.id,
        recommendation!.growthInsightId!,
        tenant.context as never,
      ),
    ).rejects.toThrow();

    await expect(
      growthRecommendationService.getById(
        otherTenant.brand.id,
        tenant.organisation.id,
        recommendation!.id,
        tenant.context as never,
      ),
    ).rejects.toThrow();
  });

  it("supports feedback lifecycle and draft creation flows", async () => {
    const { growthIntelligenceService, growthRecommendationService } = await growthServices();
    await growthIntelligenceService.analyze(
      tenant.brand.id,
      tenant.organisation.id,
      growthAnalysisFilters(30),
      tenant.context as never,
      { force: true },
    );
    const recommendation = await prisma.growthRecommendation.findFirstOrThrow({
      where: { brandId: tenant.brand.id, status: "ACTIVE" },
    });

    await growthRecommendationService.recordFeedback(
      tenant.brand.id,
      tenant.organisation.id,
      recommendation.id,
      { feedbackStatus: "ACCEPTED" },
      tenant.context as never,
    );
    await growthRecommendationService.recordFeedback(
      tenant.brand.id,
      tenant.organisation.id,
      recommendation.id,
      { feedbackStatus: "PLANNED" },
      tenant.context as never,
    );
    await growthRecommendationService.recordFeedback(
      tenant.brand.id,
      tenant.organisation.id,
      recommendation.id,
      { feedbackStatus: "IMPLEMENTED" },
      tenant.context as never,
    );
    await growthRecommendationService.recordFeedback(
      tenant.brand.id,
      tenant.organisation.id,
      recommendation.id,
      { feedbackStatus: "SUCCESSFUL", measuredOutcome: { lift: 1.2 } },
      tenant.context as never,
    );

    const effective = await prisma.recommendationOutcome.findMany({
      where: { growthRecommendationId: recommendation.id, isEffective: true },
    });
    expect(effective).toHaveLength(1);
    expect(effective[0]?.feedbackStatus).toBe("SUCCESSFUL");

    const idea = await growthRecommendationService.createDraft(
      tenant.brand.id,
      tenant.organisation.id,
      recommendation.id,
      { draftType: "CONTENT_IDEA" },
      tenant.context as never,
    );
    const experiment = await growthRecommendationService.createDraft(
      tenant.brand.id,
      tenant.organisation.id,
      recommendation.id,
      { draftType: "EXPERIMENT" },
      tenant.context as never,
    );
    const calendar = await growthRecommendationService.createDraft(
      tenant.brand.id,
      tenant.organisation.id,
      recommendation.id,
      {
        draftType: "CALENDAR_PLACEHOLDER",
        socialAccountId: tenant.account.id,
        scheduledFor: new Date("2026-08-15T10:00:00Z").toISOString(),
        timezone: "UTC",
      },
      tenant.context as never,
    );

    expect(idea.contentItemId).toBeTruthy();
    expect(experiment.experimentId).toBeTruthy();
    expect(calendar.scheduleId).toBeTruthy();
    expect(
      await prisma.contentSchedule.findUnique({ where: { id: calendar.scheduleId! } }),
    ).toMatchObject({ status: "DRAFT" });

    const studio = await growthRecommendationService.createDraft(
      tenant.brand.id,
      tenant.organisation.id,
      recommendation.id,
      { draftType: "STUDIO_BRIEF" },
      tenant.context as never,
    );
    expect(studio.contentItemId).toBeTruthy();
  });

  it("records DISMISSED feedback from an untouched recommendation", async () => {
    const { growthIntelligenceService, growthRecommendationService } = await growthServices();
    await growthIntelligenceService.analyze(
      tenant.brand.id,
      tenant.organisation.id,
      growthAnalysisFilters(30),
      tenant.context as never,
      { force: true },
    );
    const recommendation = await prisma.growthRecommendation.findFirstOrThrow({
      where: { brandId: tenant.brand.id, status: "ACTIVE", latestFeedbackStatus: null },
    });
    await growthRecommendationService.recordFeedback(
      tenant.brand.id,
      tenant.organisation.id,
      recommendation.id,
      { feedbackStatus: "DISMISSED" },
      tenant.context as never,
    );
    const dismissed = await prisma.growthRecommendation.findUniqueOrThrow({
      where: { id: recommendation.id },
    });
    expect(dismissed.latestFeedbackStatus).toBe("DISMISSED");
  });

  it("supersedes prior active recommendations when analysis reruns", async () => {
    const { growthIntelligenceService } = await growthServices();
    const filters = growthAnalysisFilters(30);
    await growthIntelligenceService.analyze(
      tenant.brand.id,
      tenant.organisation.id,
      filters,
      tenant.context as never,
      { force: true },
    );
    const firstRunRecommendations = await prisma.growthRecommendation.findMany({
      where: { brandId: tenant.brand.id },
    });
    const firstActiveCount = firstRunRecommendations.filter((item) => item.status === "ACTIVE").length;

    await growthIntelligenceService.analyze(
      tenant.brand.id,
      tenant.organisation.id,
      filters,
      tenant.context as never,
      { force: true },
    );

    const superseded = await prisma.growthRecommendation.count({
      where: { brandId: tenant.brand.id, status: "SUPERSEDED" },
    });
    const active = await prisma.growthRecommendation.count({
      where: { brandId: tenant.brand.id, status: "ACTIVE" },
    });
    expect(superseded).toBe(firstActiveCount);
    expect(active).toBe(firstActiveCount);
  });

  it("rejects duplicate active recommendations at the database constraint level", async () => {
    const { growthIntelligenceService } = await growthServices();
    await growthIntelligenceService.analyze(
      tenant.brand.id,
      tenant.organisation.id,
      growthAnalysisFilters(30),
      tenant.context as never,
      { force: true },
    );
    const existing = await prisma.growthRecommendation.findFirstOrThrow({
      where: { brandId: tenant.brand.id, status: "ACTIVE" },
    });

    await expect(
      prisma.growthRecommendation.create({
        data: {
          organisationId: existing.organisationId,
          projectId: existing.projectId,
          brandId: existing.brandId,
          growthInsightId: existing.growthInsightId,
          insightType: existing.insightType,
          analysisPeriodStart: existing.analysisPeriodStart,
          analysisPeriodEnd: existing.analysisPeriodEnd,
          idempotencyKey: `duplicate-${existing.idempotencyKey}`,
          title: existing.title,
          description: existing.description,
          finding: existing.finding,
          recommendedAction: existing.recommendedAction,
          status: "ACTIVE",
          expiresAt: existing.expiresAt,
        },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it("explains recommendations with AI validation and deterministic fallback", async () => {
    const { growthIntelligenceService } = await growthServices();
    await growthIntelligenceService.analyze(
      tenant.brand.id,
      tenant.organisation.id,
      growthAnalysisFilters(30),
      tenant.context as never,
      { force: true },
    );
    const recommendation = await prisma.growthRecommendation.findFirstOrThrow({
      where: {
        brandId: tenant.brand.id,
        status: "ACTIVE",
        growthInsight: { dataStatus: "SUFFICIENT" },
      },
      include: { growthInsight: { include: { evidence: true } } },
    });
    const evidencePayload = recommendation.growthInsight?.evidence ?? [];
    const brandContextSpy = vi.spyOn(brandContextBuilder, "build").mockReturnValue({
      brandName: tenant.brand.name,
      summary: "Test brand context",
      usedRecords: [],
    } as never);
    const validOutput = {
      finding: "Education content shows stronger engagement than the brand median.",
      explanation: "The supplied engagement evidence supports focusing on this topic.",
      recommendedAction: recommendation.recommendedAction ?? "Continue this topic.",
      evidence: evidencePayload.map((item) => ({
        evidenceKey: item.evidenceKey,
        evidenceLabel: item.evidenceLabel,
      })),
      expectedHypothesis: "Continuing this topic should sustain engagement.",
      measurementPlan: "Track engagement over the next analysis window.",
    };
    const executeSpy = vi.spyOn(aiRequestService, "executeStructured");

    executeSpy.mockResolvedValueOnce({
      requestId: "ai-request-valid",
      output: validOutput,
    } as never);

    const explained = await growthExplanationService.explain(
      {
        brandId: tenant.brand.id,
        organisationId: tenant.organisation.id,
        projectId: tenant.project.id,
        recommendation,
      },
      tenant.context as never,
      "req-valid",
    );
    expect(executeSpy).toHaveBeenCalled();
    expect(explained.explanationSource).toBe("AI");
    expect(explained.aiGenerated).toBe(true);

    executeSpy.mockResolvedValueOnce({
      requestId: "ai-request-invalid",
      output: {
        finding: "Fabricated",
        explanation: "Engagement jumped 99.99% with sample size 5000.",
        recommendedAction: "Do more",
        evidence: [{ evidenceKey: "unknown_metric", value: 99.99 }],
        expectedHypothesis: "Fabricated hypothesis",
        measurementPlan: "Fabricated measurement plan",
      },
    } as never);

    const fallback = await growthExplanationService.explain(
      {
        brandId: tenant.brand.id,
        organisationId: tenant.organisation.id,
        projectId: tenant.project.id,
        recommendation,
      },
      tenant.context as never,
      "req-invalid",
    );
    expect(fallback.explanationSource).toBe("DETERMINISTIC_FALLBACK");
    expect(fallback.aiGenerated).toBe(false);

    executeSpy.mockRejectedValueOnce(new Error("provider unavailable"));
    const providerFallback = await growthExplanationService.explain(
      {
        brandId: tenant.brand.id,
        organisationId: tenant.organisation.id,
        projectId: tenant.project.id,
        recommendation,
      },
      tenant.context as never,
      "req-provider-fail",
    );
    expect(providerFallback.explanationSource).toBe("DETERMINISTIC_FALLBACK");
    executeSpy.mockRestore();
    brandContextSpy.mockRestore();
  });

  it("records terminal UNSUCCESSFUL and INCONCLUSIVE outcomes after implementation", async () => {
    const { growthIntelligenceService, growthRecommendationService } = await growthServices();
    await growthIntelligenceService.analyze(
      tenant.brand.id,
      tenant.organisation.id,
      growthAnalysisFilters(30),
      tenant.context as never,
      { force: true },
    );

    async function implementRecommendation(recommendationId: string) {
      await growthRecommendationService.recordFeedback(
        tenant.brand.id,
        tenant.organisation.id,
        recommendationId,
        { feedbackStatus: "ACCEPTED" },
        tenant.context as never,
      );
      await growthRecommendationService.recordFeedback(
        tenant.brand.id,
        tenant.organisation.id,
        recommendationId,
        { feedbackStatus: "PLANNED" },
        tenant.context as never,
      );
      await growthRecommendationService.recordFeedback(
        tenant.brand.id,
        tenant.organisation.id,
        recommendationId,
        { feedbackStatus: "IMPLEMENTED" },
        tenant.context as never,
      );
    }

    for (const feedbackStatus of ["UNSUCCESSFUL", "INCONCLUSIVE"] as const) {
      const recommendation = await prisma.growthRecommendation.findFirstOrThrow({
        where: { brandId: tenant.brand.id, status: "ACTIVE", latestFeedbackStatus: null },
      });
      await implementRecommendation(recommendation.id);
      await growthRecommendationService.recordFeedback(
        tenant.brand.id,
        tenant.organisation.id,
        recommendation.id,
        { feedbackStatus, measuredOutcome: { lift: 0.1 } },
        tenant.context as never,
      );
      const effective = await prisma.recommendationOutcome.findFirst({
        where: {
          growthRecommendationId: recommendation.id,
          isEffective: true,
          feedbackStatus,
        },
      });
      expect(effective).toBeTruthy();
    }

    const terminalRecommendation = await prisma.growthRecommendation.findFirstOrThrow({
      where: {
        brandId: tenant.brand.id,
        latestFeedbackStatus: { in: ["UNSUCCESSFUL", "INCONCLUSIVE"] },
      },
    });
    await expect(
      growthRecommendationService.recordFeedback(
        tenant.brand.id,
        tenant.organisation.id,
        terminalRecommendation.id,
        { feedbackStatus: "IMPLEMENTED" },
        tenant.context as never,
      ),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("authorises growth routes for tenant members and rejects missing organisation context", async () => {
    process.env.ALLOW_TEST_AUTH = "true";
    process.env.TEST_AUTH_USER_ID = tenant.context.userId;
    process.env.TEST_AUTH_EMAIL = "growth-db@example.test";

    const missingOrg = await getGrowth(growthRequest(`/api/brands/${tenant.brand.id}/growth`), {
      params: Promise.resolve({ brandId: tenant.brand.id }),
    });
    expect(missingOrg.status).toBe(400);

    const authorised = await getGrowth(
      growthRequest(
        `/api/brands/${tenant.brand.id}/growth?organisationId=${tenant.organisation.id}`,
      ),
      { params: Promise.resolve({ brandId: tenant.brand.id }) },
    );
    expect(authorised.status).toBe(200);

    const viewerTenant = await createTenant();
    await prisma.organisationMembership.update({
      where: {
        organisationId_userId: {
          organisationId: viewerTenant.organisation.id,
          userId: viewerTenant.user.id,
        },
      },
      data: { role: OrganisationRole.VIEWER },
    });
    process.env.TEST_AUTH_USER_ID = viewerTenant.context.userId;
    const forbidden = await getGrowth(
      growthRequest(
        `/api/brands/${viewerTenant.brand.id}/growth?organisationId=${viewerTenant.organisation.id}`,
      ),
      { params: Promise.resolve({ brandId: viewerTenant.brand.id }) },
    );
    expect(forbidden.status).toBe(403);
  });
});
