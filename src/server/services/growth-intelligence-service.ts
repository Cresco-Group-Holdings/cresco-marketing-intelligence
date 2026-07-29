import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { zonedDayCount } from "@/lib/analytics/timezone";
import { INSIGHT_EXPIRY_DAYS } from "@/lib/growth/constants";
import {
  analysisRunIdempotencyKey,
  insightIdempotencyKey,
  recommendationIdempotencyKey,
} from "@/lib/growth/idempotency";
import {
  type PostSnapshot,
  computeBaselines,
} from "@/lib/growth/baselines";
import {
  generateInsights,
  insightToRecommendation,
  type DraftInsight,
} from "@/lib/growth/insight-engine";
import { analyzeContentPatterns } from "@/lib/growth/patterns";
import type { TenantContext } from "@/lib/tenancy/context";
import { followerGrowth } from "@/lib/social/derived-metrics";
import { brandService } from "@/server/services/workspace-service";
import {
  socialAnalyticsQueryService,
  type Filters,
} from "@/server/services/social-analytics-query-service";

type PostMetricRow = Awaited<ReturnType<typeof socialAnalyticsQueryService.posts>>[number];
type Tx = Prisma.TransactionClient;

function testFailurePoint() {
  return process.env.GROWTH_TEST_FAILURE_POINT;
}

function buildSnapshots(rows: PostMetricRow[]): PostSnapshot[] {
  const byPost = new Map<string, PostSnapshot>();

  for (const row of rows) {
    const existing = byPost.get(row.providerPostId) ?? {
      providerPostId: row.providerPostId,
      provider: row.provider,
      contentItemId: row.contentItemId,
      publishedAt: row.providerPublishedAt ? new Date(row.providerPublishedAt) : null,
      values: {},
      attribution: row.attribution
        ? {
            contentPillar: row.attribution.contentPillar,
            contentType: row.attribution.contentType,
            campaignName: row.attribution.campaignName,
            primaryCTA: row.attribution.primaryCTA,
            targetAudienceId: row.attribution.targetAudienceId,
            ownerUserId: row.attribution.ownerUserId,
            topic: null,
            topicSource: null,
            offerId: null,
            offerName: null,
            offerSource: null,
            hook: null,
            captionLength: null,
            durationSeconds: null,
            hashtags: [],
          }
        : null,
    };

    if (existing.values[row.metricType] === undefined) {
      existing.values[row.metricType] = row.metricValue;
    }
    byPost.set(row.providerPostId, existing);
  }

  return [...byPost.values()];
}

type ProvenanceMetadata = {
  hook?: string;
  topic?: string;
  offerId?: string;
};

function resolveTopic(
  metadata: ProvenanceMetadata | null,
  title?: string | null,
  primaryMessage?: string | null,
  campaignName?: string | null,
  contentPillar?: string | null,
): { topic: string | null; topicSource: PostSnapshot["attribution"] extends infer A
  ? A extends { topicSource?: infer S }
    ? S
    : never
  : never } {
  if (metadata?.topic?.trim()) {
    return { topic: metadata.topic.trim(), topicSource: "provenance" };
  }
  if (title?.trim()) return { topic: title.trim(), topicSource: "title" };
  if (primaryMessage?.trim()) {
    return { topic: primaryMessage.trim(), topicSource: "primaryMessage" };
  }
  if (campaignName?.trim()) return { topic: campaignName.trim(), topicSource: "campaign" };
  if (contentPillar?.trim()) return { topic: contentPillar.trim(), topicSource: "pillar" };
  return { topic: null, topicSource: null };
}

async function enrichSnapshots(
  snapshots: PostSnapshot[],
  organisationId: string,
  brandId: string,
): Promise<PostSnapshot[]> {
  const contentIds = [
    ...new Set(snapshots.map((s) => s.contentItemId).filter((id): id is string => Boolean(id))),
  ];
  if (!contentIds.length) return snapshots;

  const [provenance, variants, contentItems, offers] = await Promise.all([
    prisma.contentProvenance.findMany({
      where: { organisationId, brandId, contentItemId: { in: contentIds } },
      select: { contentItemId: true, metadata: true },
    }),
    prisma.contentVariant.findMany({
      where: { organisationId, brandId, contentItemId: { in: contentIds } },
      select: {
        contentItemId: true,
        caption: true,
        durationSeconds: true,
        hashtags: true,
      },
    }),
    prisma.contentItem.findMany({
      where: { organisationId, brandId, id: { in: contentIds } },
      select: {
        id: true,
        title: true,
        primaryMessage: true,
        campaignName: true,
        contentPillar: true,
      },
    }),
    prisma.brandOffer.findMany({
      where: { organisationId, brandId, archivedAt: null },
      select: { id: true, name: true },
    }),
  ]);

  const contentById = new Map(contentItems.map((item) => [item.id, item]));
  const offerById = new Map(offers.map((offer) => [offer.id, offer.name]));
  const offerByName = new Map(offers.map((offer) => [offer.name.toLowerCase(), offer]));

  const hookByContent = new Map<string, string>();
  const topicByContent = new Map<string, ReturnType<typeof resolveTopic>>();
  const offerByContent = new Map<
    string,
    { offerId: string | null; offerName: string | null; offerSource: "provenance" | "campaign" | null }
  >();

  for (const record of provenance) {
    const metadata = record.metadata as ProvenanceMetadata | null;
    if (metadata?.hook) hookByContent.set(record.contentItemId, metadata.hook);
    const content = contentById.get(record.contentItemId);
    topicByContent.set(
      record.contentItemId,
      resolveTopic(
        metadata,
        content?.title,
        content?.primaryMessage,
        content?.campaignName,
        content?.contentPillar,
      ),
    );

    if (metadata?.offerId && offerById.has(metadata.offerId)) {
      offerByContent.set(record.contentItemId, {
        offerId: metadata.offerId,
        offerName: offerById.get(metadata.offerId) ?? null,
        offerSource: "provenance",
      });
    } else if (content?.campaignName) {
      const matched = offerByName.get(content.campaignName.toLowerCase());
      if (matched) {
        offerByContent.set(record.contentItemId, {
          offerId: matched.id,
          offerName: matched.name,
          offerSource: "campaign",
        });
      }
    }
  }

  const variantByContent = new Map<string, (typeof variants)[number]>();
  for (const variant of variants) {
    const existing = variantByContent.get(variant.contentItemId);
    if (!existing || (variant.caption?.length ?? 0) > (existing.caption?.length ?? 0)) {
      variantByContent.set(variant.contentItemId, variant);
    }
  }

  return snapshots.map((snapshot) => {
    if (!snapshot.contentItemId || !snapshot.attribution) return snapshot;
    const variant = variantByContent.get(snapshot.contentItemId);
    const hook = hookByContent.get(snapshot.contentItemId) ?? null;
    const topic = topicByContent.get(snapshot.contentItemId) ?? resolveTopic(null);
    const offer = offerByContent.get(snapshot.contentItemId) ?? {
      offerId: null,
      offerName: null,
      offerSource: null,
    };
    return {
      ...snapshot,
      attribution: {
        ...snapshot.attribution,
        hook,
        topic: topic.topic,
        topicSource: topic.topicSource,
        offerId: offer.offerId,
        offerName: offer.offerName,
        offerSource: offer.offerSource,
        captionLength: variant?.caption?.length ?? null,
        durationSeconds: variant?.durationSeconds ?? null,
        hashtags: variant?.hashtags ?? [],
      },
    };
  });
}

async function followerDelta(
  brandId: string,
  organisationId: string,
  filters: Filters,
  context: TenantContext,
): Promise<number | null> {
  const accounts = await socialAnalyticsQueryService.accounts(
    brandId,
    organisationId,
    filters,
    context,
  );
  const series = accounts
    .filter((m) => ["follows", "subscribers"].includes(m.metricType))
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());
  if (series.length < 2) return null;
  return followerGrowth(series[0]!.metricValue, series.at(-1)!.metricValue);
}

function previousPeriodFilters(filters: Filters): Filters {
  const durationMs = filters.to.getTime() - filters.from.getTime();
  const previousTo = new Date(filters.from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - durationMs);
  return { ...filters, from: previousFrom, to: previousTo };
}

async function loadCompletedRunResult(
  brandId: string,
  organisationId: string,
  runIdempotencyKey: string,
) {
  const run = await prisma.growthAnalysisRun.findUnique({
    where: { brandId_idempotencyKey: { brandId, idempotencyKey: runIdempotencyKey } },
  });
  if (!run || run.status !== "COMPLETED") return null;

  const [insights, recommendations] = await Promise.all([
    prisma.growthInsight.findMany({
      where: { organisationId, brandId, analysisRunId: run.id, supersededAt: null },
      include: { evidence: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.growthRecommendation.findMany({
      where: { organisationId, brandId, analysisRunId: run.id, status: "ACTIVE" },
    }),
  ]);

  return { run, insights, recommendations };
}

async function persistAnalysisInTransaction(
  tx: Tx,
  input: {
    scope: { organisationId: string; projectId: string; brandId: string };
    from: Date;
    to: Date;
    timezone: string;
    runIdempotencyKey: string;
    draftInsights: DraftInsight[];
    benchmarks: ReturnType<typeof computeBaselines>;
    patterns: ReturnType<typeof analyzeContentPatterns>;
    postCount: number;
    expiresAt: Date;
  },
) {
  const { scope, from, to, runIdempotencyKey, draftInsights, benchmarks, patterns, postCount, expiresAt } =
    input;

  if (testFailurePoint() === "after_supersede") {
    throw new Error("Growth analysis test failure after supersede");
  }

  const run = await tx.growthAnalysisRun.upsert({
    where: {
      brandId_idempotencyKey: {
        brandId: scope.brandId,
        idempotencyKey: runIdempotencyKey,
      },
    },
    create: {
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      brandId: scope.brandId,
      analysisPeriodStart: from,
      analysisPeriodEnd: to,
      idempotencyKey: runIdempotencyKey,
      status: "RUNNING",
    },
    update: {
      status: "RUNNING",
      startedAt: new Date(),
      completedAt: null,
      errorMessage: null,
      postCount: 0,
      insightCount: 0,
      recommendationCount: 0,
    },
  });

  await tx.growthInsight.updateMany({
    where: { brandId: scope.brandId, organisationId: scope.organisationId, supersededAt: null },
    data: { supersededAt: new Date() },
  });
  await tx.growthRecommendation.updateMany({
    where: { brandId: scope.brandId, organisationId: scope.organisationId, status: "ACTIVE" },
    data: { status: "SUPERSEDED" },
  });
  await tx.performanceBenchmark.deleteMany({
    where: { brandId: scope.brandId, organisationId: scope.organisationId },
  });
  await tx.contentPattern.deleteMany({
    where: { brandId: scope.brandId, organisationId: scope.organisationId },
  });

  if (benchmarks.length) {
    await tx.performanceBenchmark.createMany({
      data: benchmarks.map((benchmark) => ({
        organisationId: scope.organisationId,
        projectId: scope.projectId,
        brandId: scope.brandId,
        benchmarkType: benchmark.benchmarkType,
        metricKey: benchmark.metricKey,
        segmentKey: benchmark.segmentKey,
        segmentLabel: benchmark.segmentLabel,
        value: benchmark.value,
        sampleSize: benchmark.sampleSize,
        periodStart: from,
        periodEnd: to,
      })),
    });
  }

  if (patterns.length) {
    await tx.contentPattern.createMany({
      data: patterns.map((pattern) => ({
        organisationId: scope.organisationId,
        projectId: scope.projectId,
        brandId: scope.brandId,
        dimension: pattern.dimension,
        dimensionValue: pattern.dimensionValue,
        metricKey: pattern.metricKey,
        metricValue: pattern.metricValue,
        sampleSize: pattern.sampleSize,
        correlationNote: pattern.correlationNote,
        periodStart: from,
        periodEnd: to,
        supportingContentIds: pattern.supportingContentIds,
        metadata: pattern.metadata as Prisma.InputJsonValue,
      })),
    });
  }

  const insights = [];
  const recommendations = [];

  for (const draft of draftInsights) {
    const idempotencyKey = insightIdempotencyKey(
      scope.brandId,
      from,
      to,
      draft.insightType,
    );
    const insight = await tx.growthInsight.create({
      data: {
        organisationId: scope.organisationId,
        projectId: scope.projectId,
        brandId: scope.brandId,
        analysisRunId: run.id,
        idempotencyKey,
        insightType: draft.insightType,
        title: draft.title,
        summary: draft.summary,
        dataStatus: draft.dataStatus,
        confidenceLevel: draft.confidenceLevel,
        comparedPeriodStart: draft.comparedPeriodStart,
        comparedPeriodEnd: draft.comparedPeriodEnd,
        analysisPeriodStart: from,
        analysisPeriodEnd: to,
        minimumDataThreshold: draft.minimumDataThreshold as Prisma.InputJsonValue,
        sourceMetrics: draft.sourceMetrics as Prisma.InputJsonValue,
        supportingContentIds: draft.supportingContentIds,
        expiresAt,
        evidence: {
          create: draft.evidence.map((item, index) => ({
            organisationId: scope.organisationId,
            brandId: scope.brandId,
            evidenceKey: item.evidenceKey,
            evidenceLabel: item.evidenceLabel,
            evidenceValue: item.evidenceValue as Prisma.InputJsonValue,
            contentItemId: item.contentItemId,
            contentVariantId: item.contentVariantId,
            providerPostId: item.providerPostId,
            sortOrder: item.sortOrder ?? index,
          })),
        },
      },
      include: { evidence: true },
    });
    insights.push(insight);

    const rec = insightToRecommendation(draft);
    if (rec) {
      const recommendation = await tx.growthRecommendation.create({
        data: {
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          analysisRunId: run.id,
          growthInsightId: insight.id,
          idempotencyKey: recommendationIdempotencyKey(
            scope.brandId,
            from,
            to,
            draft.insightType,
          ),
          insightType: draft.insightType,
          analysisPeriodStart: from,
          analysisPeriodEnd: to,
          title: rec.title,
          description: rec.description,
          recommendedAction: rec.recommendedAction,
          finding: draft.summary,
          evidenceSummary: draft.evidence as Prisma.InputJsonValue,
          priority:
            draft.confidenceLevel === "HIGH" ? 80 : draft.confidenceLevel === "MEDIUM" ? 60 : 40,
          expiresAt,
        },
      });
      recommendations.push(recommendation);
    }
  }

  if (testFailurePoint() === "before_complete") {
    throw new Error("Growth analysis test failure before complete");
  }

  const completedRun = await tx.growthAnalysisRun.update({
    where: { id: run.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      postCount,
      insightCount: insights.length,
      recommendationCount: recommendations.length,
    },
  });

  return { run: completedRun, insights, recommendations };
}

export const growthIntelligenceService = {
  async analyze(
    brandId: string,
    organisationId: string,
    filters: Filters,
    context: TenantContext,
    options?: { force?: boolean },
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const scope = { organisationId, projectId: brand.projectId, brandId };

    const { timezone, from, to } = await socialAnalyticsQueryService.resolveTimezone(
      brandId,
      organisationId,
      filters,
      context,
    );
    const resolvedFilters = { ...filters, from, to };
    const runIdempotencyKey = analysisRunIdempotencyKey(brandId, from, to);

    if (!options?.force) {
      const cached = await loadCompletedRunResult(brandId, organisationId, runIdempotencyKey);
      if (cached) {
        return {
          cached: true,
          analysisRunId: cached.run.id,
          timezone,
          period: { from: from.toISOString(), to: to.toISOString() },
          postCount: cached.run.postCount,
          insightCount: cached.insights.length,
          sufficientInsights: cached.insights.filter((item) => item.dataStatus === "SUFFICIENT")
            .length,
          recommendationCount: cached.recommendations.length,
          insights: cached.insights,
          recommendations: cached.recommendations,
        };
      }
    }

    const previousFilters = previousPeriodFilters(resolvedFilters);
    const [currentRows, previousRows] = await Promise.all([
      socialAnalyticsQueryService.posts(brandId, organisationId, resolvedFilters, context),
      socialAnalyticsQueryService.posts(brandId, organisationId, previousFilters, context),
    ]);

    let currentPosts = buildSnapshots(currentRows);
    let previousPosts = buildSnapshots(previousRows);
    currentPosts = await enrichSnapshots(currentPosts, organisationId, brandId);
    previousPosts = await enrichSnapshots(previousPosts, organisationId, brandId);

    const benchmarks = computeBaselines(currentPosts, previousPosts);
    const patterns = analyzeContentPatterns(currentPosts);
    const periodDays = zonedDayCount(from, to, timezone);

    const [followerDeltaCurrent, followerDeltaPrevious] = await Promise.all([
      followerDelta(brandId, organisationId, resolvedFilters, context),
      followerDelta(brandId, organisationId, previousFilters, context),
    ]);

    const draftInsights = generateInsights({
      currentPosts,
      previousPosts,
      benchmarks,
      analysisPeriodStart: from,
      analysisPeriodEnd: to,
      comparedPeriodStart: previousFilters.from,
      comparedPeriodEnd: previousFilters.to,
      periodDays,
      followerGrowth: followerDeltaCurrent,
      previousFollowerGrowth: followerDeltaPrevious,
    });
    const expiresAt = new Date(Date.now() + INSIGHT_EXPIRY_DAYS * 86_400_000);

    try {
      const result = await prisma.$transaction(
        async (tx) =>
          persistAnalysisInTransaction(tx, {
            scope,
            from,
            to,
            timezone,
            runIdempotencyKey,
            draftInsights,
            benchmarks,
            patterns,
            postCount: currentPosts.length,
            expiresAt,
          }),
        { timeout: 120_000 },
      );

      return {
        cached: false,
        analysisRunId: result.run.id,
        timezone,
        period: { from: from.toISOString(), to: to.toISOString() },
        postCount: currentPosts.length,
        insightCount: result.insights.length,
        sufficientInsights: result.insights.filter((item) => item.dataStatus === "SUFFICIENT")
          .length,
        recommendationCount: result.recommendations.length,
        benchmarks: benchmarks.length,
        patterns: patterns.length,
        insights: result.insights,
        recommendations: result.recommendations,
      };
    } catch (error) {
      await prisma.growthAnalysisRun.updateMany({
        where: { brandId, idempotencyKey: runIdempotencyKey, status: "RUNNING" },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Analysis failed",
        },
      });
      throw error;
    }
  },

  async listInsights(
    brandId: string,
    organisationId: string,
    context: TenantContext,
    options?: { dataStatus?: "SUFFICIENT" | "INSUFFICIENT"; limit?: number },
  ) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.growthInsight.findMany({
      where: {
        organisationId,
        brandId,
        supersededAt: null,
        ...(options?.dataStatus ? { dataStatus: options.dataStatus } : {}),
      },
      include: { evidence: { orderBy: { sortOrder: "asc" } } },
      orderBy: { generatedAt: "desc" },
      take: options?.limit ?? 50,
    });
  },

  async getInsight(
    brandId: string,
    organisationId: string,
    insightId: string,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const insight = await prisma.growthInsight.findFirst({
      where: { id: insightId, organisationId, brandId },
      include: {
        evidence: { orderBy: { sortOrder: "asc" } },
        recommendations: { include: { outcomes: { orderBy: { createdAt: "desc" } } } },
      },
    });
    if (!insight) return null;
    return insight;
  },

  async listBenchmarks(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.performanceBenchmark.findMany({
      where: { organisationId, brandId },
      orderBy: [{ benchmarkType: "asc" }, { metricKey: "asc" }],
    });
  },

  async listPatterns(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.contentPattern.findMany({
      where: { organisationId, brandId },
      orderBy: { metricValue: "desc" },
    });
  },

  async getSummary(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const [insights, recommendations, experiments] = await Promise.all([
      prisma.growthInsight.groupBy({
        by: ["dataStatus"],
        where: { organisationId, brandId, supersededAt: null },
        _count: true,
      }),
      prisma.growthRecommendation.count({
        where: { organisationId, brandId, status: "ACTIVE" },
      }),
      prisma.growthExperiment.count({
        where: { organisationId, brandId, status: { in: ["PLANNED", "RUNNING"] } },
      }),
    ]);

    const sufficient =
      insights.find((row) => row.dataStatus === "SUFFICIENT")?._count ?? 0;
    const insufficient =
      insights.find((row) => row.dataStatus === "INSUFFICIENT")?._count ?? 0;

    return {
      sufficientInsights: sufficient,
      insufficientInsights: insufficient,
      activeRecommendations: recommendations,
      activeExperiments: experiments,
    };
  },
};

export function growthAnalysisFingerprint(
  brandId: string,
  from: Date,
  to: Date,
  draftInsights: DraftInsight[],
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        brandId,
        from: from.toISOString(),
        to: to.toISOString(),
        draftInsights,
      }),
    )
    .digest("hex");
}

export const growthIntelligenceTestHooks = {
  failurePoint: () => testFailurePoint(),
  newRunId: () => randomUUID(),
};
