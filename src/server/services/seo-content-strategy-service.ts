import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { calculatePriorityScore } from "@/lib/topics/priority-scoring";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

export const seoContentStrategyService = {
  async listStrategies(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.seoContentStrategy.findMany({
      where: { organisationId, brandId },
      include: {
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        _count: { select: { versions: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  },

  async createStrategy(
    brandId: string,
    organisationId: string,
    input: { name: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const strategy = await prisma.seoContentStrategy.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        name: input.name,
      },
    });

    const clusters = await prisma.seoTopicCluster.findMany({
      where: { organisationId, brandId },
      include: { _count: { select: { members: true } } },
    });

    const version = await prisma.seoContentStrategyVersion.create({
      data: {
        organisationId,
        strategyId: strategy.id,
        versionNumber: 1,
        summary: { clusterCount: clusters.length, createdAt: new Date().toISOString() },
        clusterSnapshot: clusters.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          memberCount: c._count.members,
        })) as Prisma.InputJsonValue,
        createdByUserId: context.userProfileId,
      },
    });

    return { strategy, version };
  },

  async approveVersion(
    strategyId: string,
    versionId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const version = await prisma.seoContentStrategyVersion.findFirst({
      where: { id: versionId, strategyId, organisationId },
    });
    if (!version) throw new AppError("NOT_FOUND", "Strategy version not found.");

    await prisma.seoContentStrategyVersion.update({
      where: { id: versionId },
      data: { isApproved: true, approvedAt: new Date() },
    });

    return prisma.seoContentStrategy.update({
      where: { id: strategyId },
      data: { currentVersionId: versionId, status: "ACTIVE" },
    });
  },

  async createPillar(
    brandId: string,
    organisationId: string,
    input: {
      clusterId: string;
      title: string;
      formatType?: string;
      targetUrl?: string;
      existingPageId?: string;
      funnelStage?: string;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    return prisma.seoPillarPage.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        clusterId: input.clusterId,
        title: input.title,
        formatType: (input.formatType as "PILLAR") ?? "PILLAR",
        targetUrl: input.targetUrl,
        existingPageId: input.existingPageId,
        funnelStage: (input.funnelStage as "UNSPECIFIED") ?? "UNSPECIFIED",
      },
    });
  },

  async createSupporting(
    brandId: string,
    organisationId: string,
    input: {
      clusterId: string;
      pillarPageId?: string;
      title: string;
      formatType?: string;
      sequenceOrder?: number;
      funnelStage?: string;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    return prisma.seoSupportingPage.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        clusterId: input.clusterId,
        pillarPageId: input.pillarPageId,
        title: input.title,
        formatType: (input.formatType as "SUPPORTING_ARTICLE") ?? "SUPPORTING_ARTICLE",
        sequenceOrder: input.sequenceOrder ?? 0,
        funnelStage: (input.funnelStage as "UNSPECIFIED") ?? "UNSPECIFIED",
      },
    });
  },

  async scoreCluster(clusterId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const cluster = await prisma.seoTopicCluster.findFirst({
      where: { id: clusterId, brandId, organisationId },
      include: {
        members: { include: { keyword: { include: { metrics: true } }, contentGap: true } },
      },
    });
    if (!cluster) throw new AppError("NOT_FOUND", "Cluster not found.");

    const impressions = cluster.members
      .flatMap((m) => m.keyword?.metrics ?? [])
      .filter((m) => m.metricType === "IMPRESSIONS")
      .map((m) => m.value ?? 0);
    const avgImpressions = impressions.length ? impressions.reduce((a, b) => a + b, 0) / impressions.length : null;

    const positions = cluster.members
      .flatMap((m) => m.keyword?.metrics ?? [])
      .filter((m) => m.metricType === "AVERAGE_POSITION" || m.metricType === "RANK_POSITION")
      .map((m) => m.value ?? 0);
    const avgPosition = positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : null;

    const gapCount = cluster.members.filter((m) => m.contentGap).length;

    const result = calculatePriorityScore({
      businessRelevance: cluster.isConfirmed ? 0.8 : 0.5,
      impressions: avgImpressions,
      existingPosition: avgPosition,
      contentGap: gapCount > 0 ? Math.min(1, gapCount / 5) : null,
      strategicImportance: cluster.confidence,
    });

    return prisma.seoContentPriorityScore.create({
      data: {
        organisationId,
        brandId,
        clusterId,
        scoreVersion: result.scoreVersion,
        totalScore: result.totalScore,
        factors: result.factors as Prisma.InputJsonValue,
        missingFactors: result.missingFactors,
      },
    });
  },
};
