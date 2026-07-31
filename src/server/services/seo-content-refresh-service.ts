import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { evaluateContentDecay } from "@/lib/rank-tracking/content-decay";
import { generateRefreshRecommendations } from "@/lib/rank-tracking/refresh-recommendations";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

export const seoContentRefreshService = {
  async listCandidates(brandId: string, organisationId: string, context: TenantContext, projectId?: string) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.seoContentRefreshCandidate.findMany({
      where: {
        organisationId,
        brandId,
        ...(projectId ? { trackingProjectId: projectId } : {}),
        status: { in: ["PENDING", "REVIEWING"] },
      },
      include: {
        recommendations: { where: { status: "PENDING" }, orderBy: { confidence: "desc" } },
        crawlPage: { select: { id: true, normalisedUrl: true } },
      },
      orderBy: { decayScore: "desc" },
      take: 100,
    });
  },

  async getCandidate(candidateId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const candidate = await prisma.seoContentRefreshCandidate.findFirst({
      where: { id: candidateId, organisationId, brandId },
      include: {
        recommendations: { orderBy: { confidence: "desc" } },
        outcomes: { orderBy: { createdAt: "desc" } },
        crawlPage: true,
      },
    });
    if (!candidate) throw new AppError("NOT_FOUND", "Refresh candidate not found.");
    return candidate;
  },

  async scanForDecay(
    projectId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const project = await prisma.seoRankTrackingProject.findFirst({
      where: { id: projectId, organisationId, brandId },
    });
    if (!project) throw new AppError("NOT_FOUND", "Project not found.");

    const pages = await prisma.seoCrawlPage.findMany({
      where: { seoSiteId: project.seoSiteId, brandId, organisationId },
      include: {
        snapshots: { orderBy: { createdAt: "desc" }, take: 1 },
        keywordPageMappings: { include: { keyword: { include: { metrics: { orderBy: { measuredAt: "desc" }, take: 4 } } } } },
        issues: { where: { status: "OPEN" }, take: 5 },
        internalLinkNodes: { orderBy: { updatedAt: "desc" }, take: 1 },
      },
      take: 500,
    });

    const now = new Date();
    const rangeEnd = now.toISOString().slice(0, 10);
    const rangeStart = new Date(now.getTime() - 28 * 86400000).toISOString().slice(0, 10);
    const candidates = [];

    for (const page of pages) {
      const metrics = page.keywordPageMappings.flatMap((m) => m.keyword.metrics);
      const positions = metrics.filter((m) => m.metricType === "AVERAGE_POSITION").map((m) => m.value);
      const clicks = metrics.filter((m) => m.metricType === "CLICKS").map((m) => m.value);
      const impressions = metrics.filter((m) => m.metricType === "IMPRESSIONS").map((m) => m.value);

      const rankTrend = positions.length >= 2 ? (positions[0] ?? 0) - (positions[positions.length - 1] ?? 0) : null;
      const clicksTrend = clicks.length >= 2 && (clicks[1] ?? 0) > 0
        ? ((clicks[0] ?? 0) - (clicks[1] ?? 0)) / (clicks[1] ?? 1)
        : null;
      const impressionsTrend = impressions.length >= 2 && (impressions[1] ?? 0) > 0
        ? ((impressions[0] ?? 0) - (impressions[1] ?? 0)) / (impressions[1] ?? 1)
        : null;

      const snap = page.snapshots[0];
      const lastModifiedDays = snap?.createdAt
        ? Math.floor((now.getTime() - snap.createdAt.getTime()) / 86400000)
        : null;

      const decay = evaluateContentDecay({
        url: page.normalisedUrl,
        title: snap?.title ?? undefined,
        clicksTrend,
        impressionsTrend,
        rankTrend,
        lastModifiedDays,
        brokenLinkCount: page.issues.length > 0 ? 1 : 0,
        unresolvedOnPageIssues: page.issues.length,
        internalLinkLoss: page.internalLinkNodes[0]?.incomingCount === 0 ? 1 : 0,
      });

      if (!decay.isCandidate) continue;

      const existing = await prisma.seoContentRefreshCandidate.findFirst({
        where: { trackingProjectId: projectId, crawlPageId: page.id, status: { in: ["PENDING", "REVIEWING"] } },
      });

      const candidate = existing
        ? await prisma.seoContentRefreshCandidate.update({
            where: { id: existing.id },
            data: {
              decayScore: decay.decayScore,
              signals: decay.signals as unknown as Prisma.InputJsonValue,
              evidence: { signals: decay.signals, metricsCount: metrics.length } as unknown as Prisma.InputJsonValue,
              dateRangeEnd: new Date(rangeEnd),
            },
          })
        : await prisma.seoContentRefreshCandidate.create({
            data: {
              organisationId,
              projectId: brand.projectId,
              brandId,
              trackingProjectId: projectId,
              crawlPageId: page.id,
              url: page.normalisedUrl,
              title: snap?.title ?? undefined,
              decayScore: decay.decayScore,
              signals: decay.signals as unknown as Prisma.InputJsonValue,
              evidence: { signals: decay.signals, metricsCount: metrics.length } as unknown as Prisma.InputJsonValue,
              dateRangeStart: new Date(rangeStart),
              dateRangeEnd: new Date(rangeEnd),
            },
          });

      if (!existing) {
        const recs = generateRefreshRecommendations(decay.signals, rangeStart, rangeEnd);
        for (const rec of recs.slice(0, 5)) {
          await prisma.seoContentRefreshRecommendation.create({
            data: {
              organisationId,
              candidateId: candidate.id,
              recommendationType: rec.recommendationType,
              evidence: rec.evidence as Prisma.InputJsonValue,
              dateRangeStart: new Date(rangeStart),
              dateRangeEnd: new Date(rangeEnd),
              confidence: rec.confidence,
              expectedHypothesis: rec.expectedHypothesis,
              measurementPlan: rec.measurementPlan,
            },
          });
        }
      }
      candidates.push(candidate);
    }

    return candidates;
  },

  async convertToWorkflow(
    candidateId: string,
    recommendationId: string,
    workflowType: "SEO_BRIEF" | "CONTENT_TASK" | "LONG_FORM_REVISION" | "EXPERIMENT" | "INTERNAL_LINK_PROPOSAL" | "TECHNICAL_FIX",
    brandId: string,
    organisationId: string,
    userId: string,
    context: TenantContext,
  ) {
    const candidate = await this.getCandidate(candidateId, brandId, organisationId, context);
    const recommendation = candidate.recommendations.find((r: { id: string }) => r.id === recommendationId);
    if (!recommendation) throw new AppError("NOT_FOUND", "Recommendation not found.");

    const outcome = await prisma.seoContentRefreshOutcome.create({
      data: {
        organisationId,
        candidateId,
        recommendationId,
        workflowType,
        status: "CREATED",
        outcomeData: { recommendationType: recommendation.recommendationType },
        createdByUserId: userId,
      },
    });

    await prisma.seoContentRefreshRecommendation.update({
      where: { id: recommendationId },
      data: { status: "CONVERTED" },
    });

    await prisma.seoContentRefreshCandidate.update({
      where: { id: candidateId },
      data: { status: "CONVERTED" },
    });

    return outcome;
  },
};
