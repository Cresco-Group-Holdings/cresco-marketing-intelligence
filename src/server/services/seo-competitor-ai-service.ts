import { competitorAiAnalysisSchema } from "@/lib/ai/competitor-output-schemas";
import { brandContextBuilder } from "@/lib/ai/brand-context-builder";
import { prisma } from "@/lib/database/prisma";
import type { TenantContext } from "@/lib/tenancy/context";
import { aiRequestService } from "@/server/services/ai-request-service";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { seoCompetitorService } from "@/server/services/seo-competitor-service";
import { brandService } from "@/server/services/workspace-service";

export const seoCompetitorAiService = {
  async analyzeCompetitor(
    competitorId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const competitor = await seoCompetitorService.getById(competitorId, brandId, organisationId, context);
    const snapshot = await brandKnowledgeService.getSnapshot(brandId, organisationId, context);
    const brandContext = brandContextBuilder.build(snapshot, {});

    const overlaps = await prisma.seoKeywordOverlap.findMany({
      where: { organisationId, brandId, competitorId },
      take: 50,
    });
    const gaps = await prisma.seoContentGap.findMany({
      where: { organisationId, brandId, competitorId, status: "OPEN" },
      take: 20,
    });
    const topics = await prisma.seoCompetitorTopic.findMany({
      where: { competitorId },
      take: 20,
    });

    const evidenceSummary = {
      competitorName: competitor.name,
      competitorType: competitor.competitorType,
      overlapCounts: {
        shared: overlaps.filter((o) => o.overlapType === "SHARED").length,
        brandUnique: overlaps.filter((o) => o.overlapType === "BRAND_UNIQUE").length,
        competitorUnique: overlaps.filter((o) => o.overlapType === "COMPETITOR_UNIQUE").length,
      },
      openGaps: gaps.length,
      topTopics: topics.slice(0, 10).map((t) => ({ topic: t.topic, pageCount: t.pageCount })),
      dataLimitations:
        "Analysis based on publicly crawled pages and traceable keyword observations only. No private analytics, traffic, or search volume data.",
    };

    const result = await aiRequestService.executeStructured(
      {
        organisationId,
        projectId: brand.projectId,
        brandId,
        userProfileId: context.userProfileId,
        purpose: "SEO_ANALYSIS",
        templateKey: "seo.competitors.analyze",
        userInput: [
          `Analyse competitor "${competitor.name}" (${competitor.competitorType}) for brand search coverage.`,
          "Use only the evidence provided. Do NOT invent traffic, rankings, backlinks, search volume, or revenue.",
          "Do NOT recommend copying competitor content. Emphasise originality.",
          `Evidence: ${JSON.stringify(evidenceSummary)}`,
          `Content gaps: ${JSON.stringify(gaps.map((g) => ({ type: g.gapType, title: g.title })))}`,
        ].join("\n"),
        brandContext: brandContext as unknown as Record<string, unknown>,
        schemaKey: "seo.competitors.analyze",
      },
      context,
    );

    const parsed = competitorAiAnalysisSchema.parse(result.output);

    await prisma.seoCompetitorEvidence.create({
      data: {
        organisationId,
        evidenceType: "ai_analysis",
        metadata: { competitorId, analysis: parsed, requestId: result.requestId },
      },
    });

    return { analysis: parsed, evidenceSummary, disclaimer: evidenceSummary.dataLimitations };
  },
};
