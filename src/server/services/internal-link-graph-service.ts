import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

export const internalLinkGraphService = {
  async list(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.internalLinkGraph.findMany({
      where: { organisationId, brandId },
      include: {
        seoSite: { select: { id: true, name: true, primaryDomain: true } },
        _count: { select: { nodes: true, edges: true, issues: true, recommendations: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
  },

  async getById(graphId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const graph = await prisma.internalLinkGraph.findFirst({
      where: { id: graphId, organisationId, brandId },
      include: {
        seoSite: true,
        nodes: { orderBy: { incomingCount: "asc" }, take: 200 },
        edges: { take: 500 },
        issues: { where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 100 },
        recommendations: { where: { status: "PENDING" }, orderBy: { confidence: "desc" }, take: 50 },
        snapshots: { orderBy: { versionNumber: "desc" }, take: 5 },
        _count: { select: { nodes: true, edges: true, issues: true, recommendations: true } },
      },
    });
    if (!graph) throw new AppError("NOT_FOUND", "Internal link graph not found.");
    return graph;
  },

  async getPageDetail(graphId: string, pageId: string, brandId: string, organisationId: string, context: TenantContext) {
    await this.getById(graphId, brandId, organisationId, context);
    const node = await prisma.internalLinkNode.findFirst({
      where: { id: pageId, graphId, organisationId },
      include: {
        outgoingEdges: { include: { targetNode: true }, take: 50 },
        incomingEdges: { include: { sourceNode: true }, take: 50 },
        anchors: true,
        cluster: { select: { id: true, name: true } },
        issues: { where: { status: "OPEN" } },
        sourceRecommendations: { where: { status: "PENDING" }, take: 10 },
        targetRecommendations: { where: { status: "PENDING" }, take: 10 },
      },
    });
    if (!node) throw new AppError("NOT_FOUND", "Page node not found.");
    return node;
  },

  async getOrphans(graphId: string, brandId: string, organisationId: string, context: TenantContext) {
    await this.getById(graphId, brandId, organisationId, context);
    return prisma.internalLinkNode.findMany({
      where: { graphId, organisationId, OR: [{ isOrphan: true }, { isNearOrphan: true }] },
      orderBy: { incomingCount: "asc" },
      take: 200,
    });
  },
};
