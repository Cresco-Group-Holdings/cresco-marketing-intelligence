import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { buildDeterministicClusters } from "@/lib/topics/cluster-rules";
import { buildClusterGraph } from "@/lib/topics/graph-builder";
import { calculateFunnelCoverage } from "@/lib/topics/funnel-coverage";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export const seoTopicClusterService = {
  async listTopics(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.seoTopic.findMany({
      where: { organisationId, brandId, status: "ACTIVE" },
      include: { _count: { select: { clusters: true } } },
      orderBy: { name: "asc" },
    });
  },

  async createTopic(
    brandId: string,
    organisationId: string,
    input: { name: string; description?: string; funnelStage?: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const slug = slugify(input.name);
    return prisma.seoTopic.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        name: input.name,
        slug,
        description: input.description,
        funnelStage: (input.funnelStage as "UNSPECIFIED") ?? "UNSPECIFIED",
      },
    });
  },

  async listClusters(
    brandId: string,
    organisationId: string,
    context: TenantContext,
    filters?: { topicId?: string; status?: string },
  ) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.seoTopicCluster.findMany({
      where: {
        organisationId,
        brandId,
        ...(filters?.topicId ? { topicId: filters.topicId } : {}),
        ...(filters?.status ? { status: filters.status as "CONFIRMED" } : {}),
      },
      include: {
        topic: true,
        _count: { select: { members: true, pillarPages: true, supportingPages: true } },
      },
      orderBy: { name: "asc" },
    });
  },

  async getCluster(clusterId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const cluster = await prisma.seoTopicCluster.findFirst({
      where: { id: clusterId, organisationId, brandId },
      include: {
        topic: true,
        members: {
          include: {
            keyword: { select: { id: true, displayKeyword: true, primaryIntent: true } },
            page: { select: { id: true, normalisedUrl: true } },
            contentGap: { select: { id: true, title: true, gapType: true } },
          },
        },
        pillarPages: { include: { supportingPages: true } },
        supportingPages: true,
        gapPlans: true,
        priorityScores: { orderBy: { calculatedAt: "desc" }, take: 5 },
      },
    });
    if (!cluster) throw new AppError("NOT_FOUND", "Cluster not found.");
    return cluster;
  },

  async createCluster(
    brandId: string,
    organisationId: string,
    input: { name: string; description?: string; topicId?: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const slug = slugify(input.name);
    return prisma.seoTopicCluster.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        topicId: input.topicId,
        name: input.name,
        slug,
        description: input.description,
        namingSource: "manual",
        isConfirmed: true,
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    });
  },

  async updateCluster(
    clusterId: string,
    brandId: string,
    organisationId: string,
    input: { name?: string; description?: string; status?: string; isConfirmed?: boolean },
    context: TenantContext,
  ) {
    await this.getCluster(clusterId, brandId, organisationId, context);
    return prisma.seoTopicCluster.update({
      where: { id: clusterId },
      data: {
        ...input,
        status: input.status as "CONFIRMED" | undefined,
        confirmedAt: input.isConfirmed ? new Date() : undefined,
      },
    });
  },

  async addMember(
    clusterId: string,
    brandId: string,
    organisationId: string,
    input: {
      memberType: "KEYWORD" | "PAGE" | "ENTITY" | "COMPETITOR_GAP";
      keywordId?: string;
      pageId?: string;
      entityId?: string;
      contentGapId?: string;
      isLocked?: boolean;
    },
    context: TenantContext,
  ) {
    await this.getCluster(clusterId, brandId, organisationId, context);
    return prisma.seoTopicClusterMember.create({
      data: {
        organisationId,
        clusterId,
        memberType: input.memberType,
        keywordId: input.keywordId,
        pageId: input.pageId,
        entityId: input.entityId,
        contentGapId: input.contentGapId,
        isManuallyConfirmed: true,
        isLocked: input.isLocked ?? true,
        confidence: 1,
        evidence: { source: "manual" },
      },
    });
  },

  async runClustering(
    brandId: string,
    organisationId: string,
    input: { includeCompetitorGaps?: boolean },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);

    const keywords = await prisma.seoKeyword.findMany({
      where: { organisationId, brandId, status: "ACTIVE" },
      include: {
        entities: true,
        metrics: { where: { metricType: "IMPRESSIONS" }, orderBy: { measuredAt: "desc" }, take: 1 },
        topicClusterMembers: { where: { isLocked: true } },
      },
      take: 500,
    });

    const clusterInputs = keywords.map((k) => ({
      id: k.id,
      keyword: k.displayKeyword,
      normalisedKeyword: k.normalisedKeyword,
      primaryIntent: k.primaryIntent,
      entities: k.entities.map((e) => ({ entityType: e.entityType, canonicalValue: e.canonicalValue })),
      impressions: k.metrics[0]?.value ?? null,
      isLocked: k.topicClusterMembers.some((m) => m.isLocked),
      existingClusterId: k.topicClusterMembers[0]?.clusterId,
    }));

    const proposed = buildDeterministicClusters(clusterInputs);
    const created = [];

    for (const cluster of proposed) {
      if (cluster.evidence.preservedLocked) continue;

      let slug = cluster.slug;
      let suffix = 1;
      while (await prisma.seoTopicCluster.findUnique({ where: { brandId_slug: { brandId, slug } } })) {
        slug = `${cluster.slug}-${suffix++}`;
      }

      const record = await prisma.seoTopicCluster.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          name: cluster.name,
          slug,
          confidence: cluster.confidence,
          evidence: cluster.evidence as Prisma.InputJsonValue,
          namingSource: cluster.namingSource,
          isAiSuggested: cluster.namingSource === "ai",
          status: "PROPOSED",
        },
      });

      for (const keywordId of cluster.keywordIds) {
        const locked = clusterInputs.find((k) => k.id === keywordId)?.isLocked;
        if (locked) continue;
        await prisma.seoTopicClusterMember.create({
          data: {
            organisationId,
            clusterId: record.id,
            memberType: "KEYWORD",
            keywordId,
            confidence: cluster.confidence,
            evidence: cluster.evidence as Prisma.InputJsonValue,
          },
        });
      }

      if (input.includeCompetitorGaps) {
        const gaps = await prisma.seoContentGap.findMany({
          where: { organisationId, brandId, status: "OPEN" },
          take: 20,
        });
        for (const gap of gaps) {
          const matches = cluster.keywordIds.some((kid) => {
            const kw = keywords.find((k) => k.id === kid);
            return gap.keyword && kw?.normalisedKeyword.includes(gap.keyword.toLowerCase());
          });
          if (matches) {
            await prisma.seoTopicClusterMember.create({
              data: {
                organisationId,
                clusterId: record.id,
                memberType: "COMPETITOR_GAP",
                contentGapId: gap.id,
                evidence: { gapType: gap.gapType } as Prisma.InputJsonValue,
              },
            });
          }
        }
      }

      created.push(record);
    }

    return { clusters: created, proposedCount: proposed.length };
  },

  async getClusterGraph(clusterId: string, brandId: string, organisationId: string, context: TenantContext) {
    const cluster = await this.getCluster(clusterId, brandId, organisationId, context);
    return buildClusterGraph({
      clusters: [{ id: cluster.id, name: cluster.name, status: cluster.status }],
      pillars: cluster.pillarPages.map((p) => ({
        id: p.id,
        clusterId: cluster.id,
        title: p.title,
        existingPageId: p.existingPageId,
      })),
      supporting: cluster.supportingPages.map((s) => ({
        id: s.id,
        clusterId: cluster.id,
        pillarPageId: s.pillarPageId,
        title: s.title,
        existingPageId: s.existingPageId,
      })),
      keywords: cluster.members
        .filter((m) => m.keyword)
        .map((m) => ({ id: m.keyword!.id, clusterId: cluster.id, label: m.keyword!.displayKeyword })),
      gaps: cluster.gapPlans.map((g) => ({ id: g.id, clusterId: cluster.id, title: g.title })),
    });
  },

  async getFunnelCoverage(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const keywords = await prisma.seoKeyword.findMany({
      where: { organisationId, brandId, status: "ACTIVE" },
      include: { pageMappings: true },
      take: 500,
    });
    const pillars = await prisma.seoPillarPage.findMany({ where: { organisationId, brandId } });
    const supporting = await prisma.seoSupportingPage.findMany({ where: { organisationId, brandId } });

    return calculateFunnelCoverage({
      keywords: keywords.map((k) => ({
        intent: k.primaryIntent,
        hasPage: k.pageMappings.length > 0,
      })),
      pages: [
        ...pillars.map((p) => ({ funnelStage: p.funnelStage })),
        ...supporting.map((s) => ({ funnelStage: s.funnelStage })),
      ],
    });
  },
};
