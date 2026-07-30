import type { Prisma } from "@prisma/client";
import { topicClusterAiSchema } from "@/lib/ai/topic-output-schemas";
import { brandContextBuilder } from "@/lib/ai/brand-context-builder";
import { prisma } from "@/lib/database/prisma";
import type { TenantContext } from "@/lib/tenancy/context";
import { aiRequestService } from "@/server/services/ai-request-service";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { seoTopicClusterService } from "@/server/services/seo-topic-cluster-service";
import { brandService } from "@/server/services/workspace-service";

export const seoTopicClusterAiService = {
  async proposeStrategy(
    clusterId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const cluster = await seoTopicClusterService.getCluster(clusterId, brandId, organisationId, context);
    const snapshot = await brandKnowledgeService.getSnapshot(brandId, organisationId, context);
    const brandContext = brandContextBuilder.build(snapshot, {});

    const evidence = {
      clusterName: cluster.name,
      memberCount: cluster.members.length,
      keywords: cluster.members
        .filter((m) => m.keyword)
        .slice(0, 20)
        .map((m) => m.keyword!.displayKeyword),
      gaps: cluster.gapPlans.map((g) => g.title),
      funnelStages: cluster.pillarPages.map((p) => p.funnelStage),
      limitations: "Proposals require user approval. Do not invent traffic or search volume.",
    };

    const result = await aiRequestService.executeStructured(
      {
        organisationId,
        projectId: brand.projectId,
        brandId,
        userProfileId: context.userProfileId,
        purpose: "SEO_ANALYSIS",
        templateKey: "seo.topics.strategy",
        userInput: [
          `Propose SEO content strategy for cluster "${cluster.name}".`,
          "Include pillar structure, supporting sequence, audience questions, and differentiation.",
          "All proposals require evidence and user approval before application.",
          `Evidence: ${JSON.stringify(evidence)}`,
        ].join("\n"),
        brandContext: brandContext as unknown as Record<string, unknown>,
        schemaKey: "seo.topics.strategy",
      },
      context,
    );

    const parsed = topicClusterAiSchema.parse(result.output);

    const strategy = await prisma.seoContentStrategy.findFirst({
      where: { organisationId, brandId, status: "ACTIVE" },
    });

    if (strategy) {
      const lastVersion = await prisma.seoContentStrategyVersion.findFirst({
        where: { strategyId: strategy.id },
        orderBy: { versionNumber: "desc" },
      });
      await prisma.seoContentStrategyVersion.create({
        data: {
          organisationId,
          strategyId: strategy.id,
          versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
          summary: { clusterId, clusterName: cluster.name },
          aiProposals: parsed as unknown as Prisma.InputJsonValue,
          createdByUserId: context.userProfileId,
        },
      });
    }

    await prisma.seoTopicCluster.update({
      where: { id: clusterId },
      data: {
        isAiSuggested: true,
        namingSource: "ai",
        evidence: { aiProposal: parsed, requestId: result.requestId } as Prisma.InputJsonValue,
      },
    });

    return { proposal: parsed, requiresApproval: true, evidence };
  },
};
