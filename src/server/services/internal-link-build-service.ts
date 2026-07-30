import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { classifyAnchor, detectAnchorRepetition } from "@/lib/internal-links/anchor-classification";
import {
  calculateGraphMetrics,
  computeCrawlDepths,
  type GraphNodeInput,
} from "@/lib/internal-links/graph-metrics";
import { detectLinkIssues } from "@/lib/internal-links/issue-detection";
import { generateLinkRecommendations } from "@/lib/internal-links/recommendations";
import { sampleNodesForVisualization } from "@/lib/internal-links/graph-metrics";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

export const internalLinkBuildService = {
  async buildGraph(
    brandId: string,
    organisationId: string,
    seoSiteId: string,
    context: TenantContext,
    crawlRunId?: string,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const site = await prisma.seoSite.findFirst({ where: { id: seoSiteId, brandId, organisationId } });
    if (!site) throw new Error("SEO site not found");

    const graph = await prisma.internalLinkGraph.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        seoSiteId,
        crawlRunId,
        status: "BUILDING",
      },
    });

    const pages = await prisma.seoCrawlPage.findMany({
      where: { seoSiteId, brandId, organisationId },
      include: {
        snapshots: { orderBy: { createdAt: "desc" }, take: 1 },
        inboundLinks: crawlRunId ? { where: { crawlRunId } } : { take: 100 },
        outboundLinks: crawlRunId ? { where: { crawlRunId } } : { take: 100 },
        topicClusterMembers: { include: { cluster: true }, take: 1 },
      },
      take: 5000,
    });

    const urlToNodeId = new Map<string, string>();
    const nodeRecords: Array<{ id: string; crawlPageId: string; url: string; title?: string; clusterId?: string; isIndexable: boolean }> = [];

    for (const page of pages) {
      const snap = page.snapshots[0];
      const node = await prisma.internalLinkNode.create({
        data: {
          organisationId,
          graphId: graph.id,
          crawlPageId: page.id,
          url: page.normalisedUrl,
          title: snap?.title ?? undefined,
          isIndexable: !(snap?.robotsDirective ?? "").toLowerCase().includes("noindex"),
          clusterId: page.topicClusterMembers[0]?.clusterId,
        },
      });
      urlToNodeId.set(page.normalisedUrl, node.id);
      nodeRecords.push({
        id: node.id,
        crawlPageId: page.id,
        url: page.normalisedUrl,
        title: snap?.title ?? undefined,
        clusterId: page.topicClusterMembers[0]?.clusterId,
        isIndexable: node.isIndexable,
      });
    }

    const graphNodes: GraphNodeInput[] = [];
    const existingEdges = new Set<string>();
    const anchorCounts = new Map<string, number>();

    for (const page of pages) {
      const nodeId = urlToNodeId.get(page.normalisedUrl)!;
      const incoming = page.inboundLinks.map((l) => l.sourceUrl);
      const outgoing = page.outboundLinks.map((l) => ({
        targetUrl: l.destinationUrl,
        anchorText: l.anchorText ?? undefined,
        statusCode: l.statusCode ?? undefined,
        isRedirect: (l.statusCode ?? 0) >= 300 && (l.statusCode ?? 0) < 400,
        isNoindex: false,
      }));

      for (const link of page.outboundLinks) {
        const targetId = urlToNodeId.get(link.destinationUrl);
        const anchorType = classifyAnchor(link.anchorText);
        await prisma.internalLinkEdge.create({
          data: {
            organisationId,
            graphId: graph.id,
            sourceNodeId: nodeId,
            targetNodeId: targetId,
            targetUrl: link.destinationUrl,
            anchorText: link.anchorText,
            anchorType,
            statusCode: link.statusCode,
            isBroken: (link.statusCode ?? 0) >= 400,
            isRedirect: (link.statusCode ?? 0) >= 300 && (link.statusCode ?? 0) < 400,
          },
        });
        existingEdges.add(`${page.normalisedUrl}->${link.destinationUrl}`);

        const anchor = (link.anchorText ?? "").trim().toLowerCase();
        if (anchor) anchorCounts.set(anchor, (anchorCounts.get(anchor) ?? 0) + 1);
      }

      graphNodes.push({
        id: nodeId,
        url: page.normalisedUrl,
        title: page.snapshots[0]?.title ?? undefined,
        clusterId: page.topicClusterMembers[0]?.clusterId,
        isIndexable: !(page.snapshots[0]?.robotsDirective ?? "").toLowerCase().includes("noindex"),
        incomingLinks: incoming,
        outgoingLinks: outgoing,
      });
    }

    const edgePairs = pages.flatMap((p) =>
      p.outboundLinks
        .map((l) => ({ sourceId: urlToNodeId.get(p.normalisedUrl)!, targetId: urlToNodeId.get(l.destinationUrl) }))
        .filter((e): e is { sourceId: string; targetId: string } => !!e.sourceId && !!e.targetId),
    );
    const depths = computeCrawlDepths(
      nodeRecords.map((n) => ({ id: n.id, url: n.url })),
      edgePairs as Array<{ sourceId: string; targetId: string }>,
      site.primaryDomain,
    );

    for (const gn of graphNodes) {
      const incomingCount = gn.incomingLinks.length;
      const outgoingCount = gn.outgoingLinks.length;
      await prisma.internalLinkNode.update({
        where: { id: gn.id },
        data: {
          incomingCount,
          outgoingCount,
          isOrphan: incomingCount === 0,
          isNearOrphan: incomingCount === 1,
          crawlDepth: depths.get(gn.id),
          topicalConnections: gn.clusterId ? incomingCount + outgoingCount : 0,
        },
      });
    }

    const metrics = calculateGraphMetrics(graphNodes);
    const repetitive = detectAnchorRepetition(
      [...anchorCounts.entries()].map(([text, count]) => ({ text, count })),
    );

    for (const r of repetitive) {
      await prisma.internalLinkAnchor.create({
        data: {
          organisationId,
          graphId: graph.id,
          anchorText: r.text,
          classification: classifyAnchor(r.text),
          occurrenceCount: r.count,
          isRepetitive: true,
        },
      });
    }

    const pillarPages = await prisma.seoPillarPage.findMany({
      where: { brandId, organisationId },
      select: { existingPageId: true },
    });
    const importantIds = new Set(
      pillarPages.map((p) => p.existingPageId).filter(Boolean) as string[],
    );
    const importantNodeIds = new Set(
      nodeRecords.filter((n) => importantIds.has(n.crawlPageId)).map((n) => n.id),
    );

    const issues = detectLinkIssues(graphNodes, metrics, anchorCounts, importantNodeIds);
    for (const issue of issues) {
      await prisma.internalLinkIssue.create({
        data: {
          organisationId,
          graphId: graph.id,
          issueType: issue.issueType,
          severity: issue.severity,
          title: issue.title,
          description: issue.description,
          evidence: issue.evidence as Prisma.InputJsonValue,
          sourceNodeId: issue.sourceNodeId,
          targetNodeId: issue.targetNodeId,
        },
      });
    }

    const recs = generateLinkRecommendations({
      nodes: graphNodes.map((n) => ({
        id: n.id,
        url: n.url,
        title: n.title,
        incomingCount: n.incomingLinks.length,
        outgoingCount: n.outgoingLinks.length,
        clusterId: n.clusterId,
        isOrphan: n.incomingLinks.length === 0,
        isNearOrphan: n.incomingLinks.length === 1,
      })),
      existingEdges,
    });

    for (const rec of recs) {
      await prisma.internalLinkRecommendation.create({
        data: {
          organisationId,
          graphId: graph.id,
          sourceNodeId: rec.sourceNodeId,
          targetNodeId: rec.targetNodeId,
          suggestedAnchorConcept: rec.suggestedAnchorConcept,
          contextualReason: rec.contextualReason,
          confidence: rec.confidence,
          evidence: rec.evidence as Prisma.InputJsonValue,
          potentialConflict: rec.potentialConflict,
        },
      });
    }

    const snapshotCount = await prisma.internalLinkSnapshot.count({ where: { graphId: graph.id } });
    await prisma.internalLinkSnapshot.create({
      data: {
        organisationId,
        graphId: graph.id,
        versionNumber: snapshotCount + 1,
        nodeCount: metrics.nodeCount,
        edgeCount: metrics.edgeCount,
        metrics: metrics as unknown as Prisma.InputJsonValue,
      },
    });

    await prisma.internalLinkGraph.update({
      where: { id: graph.id },
      data: {
        status: "READY",
        nodeCount: metrics.nodeCount,
        edgeCount: metrics.edgeCount,
        metrics: metrics as unknown as Prisma.InputJsonValue,
      },
    });

    return prisma.internalLinkGraph.findFirst({
      where: { id: graph.id },
      include: { _count: { select: { nodes: true, edges: true, issues: true, recommendations: true } } },
    });
  },

  async getVisualization(graphId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const nodes = await prisma.internalLinkNode.findMany({
      where: { graphId, organisationId },
      select: { id: true, url: true, title: true, incomingCount: true, outgoingCount: true, isOrphan: true, crawlDepth: true, clusterId: true },
    });
    const edges = await prisma.internalLinkEdge.findMany({
      where: { graphId, organisationId },
      select: { id: true, sourceNodeId: true, targetNodeId: true, anchorText: true },
      take: 2000,
    });

    const { sampled, total, truncated } = sampleNodesForVisualization(nodes);
    const sampledIds = new Set(sampled.map((n) => n.id));

    return {
      nodes: sampled,
      edges: edges.filter((e) => sampledIds.has(e.sourceNodeId) || (e.targetNodeId && sampledIds.has(e.targetNodeId))),
      totalNodes: total,
      truncated,
    };
  },
};
