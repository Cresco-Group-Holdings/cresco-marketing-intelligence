import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { zonedDayCount } from "@/lib/analytics/timezone";
import { INSIGHT_EXPIRY_DAYS } from "@/lib/growth/constants";
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

async function enrichSnapshots(
  snapshots: PostSnapshot[],
  organisationId: string,
  brandId: string,
): Promise<PostSnapshot[]> {
  const contentIds = [
    ...new Set(snapshots.map((s) => s.contentItemId).filter((id): id is string => Boolean(id))),
  ];
  if (!contentIds.length) return snapshots;

  const [provenance, variants] = await Promise.all([
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
  ]);

  const hookByContent = new Map<string, string>();
  for (const record of provenance) {
    const metadata = record.metadata as { hook?: string } | null;
    if (metadata?.hook) hookByContent.set(record.contentItemId, metadata.hook);
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
    return {
      ...snapshot,
      attribution: {
        ...snapshot.attribution,
        hook,
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

async function persistInsight(
  scope: { organisationId: string; projectId: string; brandId: string },
  draft: DraftInsight,
  period: { from: Date; to: Date },
  expiresAt: Date,
) {
  return prisma.growthInsight.create({
    data: {
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      brandId: scope.brandId,
      insightType: draft.insightType,
      title: draft.title,
      summary: draft.summary,
      dataStatus: draft.dataStatus,
      confidenceLevel: draft.confidenceLevel,
      comparedPeriodStart: draft.comparedPeriodStart,
      comparedPeriodEnd: draft.comparedPeriodEnd,
      analysisPeriodStart: period.from,
      analysisPeriodEnd: period.to,
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
}

export const growthIntelligenceService = {
  async analyze(
    brandId: string,
    organisationId: string,
    filters: Filters,
    context: TenantContext,
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

    const analysisCtx = {
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
    };

    const draftInsights = generateInsights(analysisCtx);
    const expiresAt = new Date(Date.now() + INSIGHT_EXPIRY_DAYS * 86_400_000);

    await prisma.$transaction(async (tx) => {
      await tx.growthInsight.updateMany({
        where: { brandId, organisationId, supersededAt: null },
        data: { supersededAt: new Date() },
      });
      await tx.performanceBenchmark.deleteMany({ where: { brandId, organisationId } });
      await tx.contentPattern.deleteMany({ where: { brandId, organisationId } });

      if (benchmarks.length) {
        await tx.performanceBenchmark.createMany({
          data: benchmarks.map((b) => ({
            organisationId,
            projectId: brand.projectId,
            brandId,
            benchmarkType: b.benchmarkType,
            metricKey: b.metricKey,
            segmentKey: b.segmentKey,
            segmentLabel: b.segmentLabel,
            value: b.value,
            sampleSize: b.sampleSize,
            periodStart: from,
            periodEnd: to,
          })),
        });
      }

      if (patterns.length) {
        await tx.contentPattern.createMany({
          data: patterns.map((p) => ({
            organisationId,
            projectId: brand.projectId,
            brandId,
            dimension: p.dimension,
            dimensionValue: p.dimensionValue,
            metricKey: p.metricKey,
            metricValue: p.metricValue,
            sampleSize: p.sampleSize,
            correlationNote: p.correlationNote,
            periodStart: from,
            periodEnd: to,
            supportingContentIds: p.supportingContentIds,
          })),
        });
      }
    });

    const insights = [];
    const recommendations = [];

    for (const draft of draftInsights) {
      const insight = await persistInsight(scope, draft, { from, to }, expiresAt);
      insights.push(insight);

      const rec = insightToRecommendation(draft);
      if (rec) {
        const recommendation = await prisma.growthRecommendation.create({
          data: {
            organisationId,
            projectId: brand.projectId,
            brandId,
            growthInsightId: insight.id,
            insightType: draft.insightType,
            title: rec.title,
            description: rec.description,
            recommendedAction: rec.recommendedAction,
            finding: draft.summary,
            evidenceSummary: draft.evidence as Prisma.InputJsonValue,
            priority: draft.confidenceLevel === "HIGH" ? 80 : draft.confidenceLevel === "MEDIUM" ? 60 : 40,
            expiresAt,
          },
        });
        recommendations.push(recommendation);
      }
    }

    return {
      timezone,
      period: { from: from.toISOString(), to: to.toISOString() },
      postCount: currentPosts.length,
      insightCount: insights.length,
      sufficientInsights: insights.filter((i) => i.dataStatus === "SUFFICIENT").length,
      recommendationCount: recommendations.length,
      benchmarks: benchmarks.length,
      patterns: patterns.length,
      insights,
      recommendations,
    };
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
