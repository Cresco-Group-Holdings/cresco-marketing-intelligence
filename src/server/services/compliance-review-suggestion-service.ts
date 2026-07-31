import { brandContextBuilder } from "@/lib/ai/brand-context-builder";
import { complianceAiReviewSchema } from "@/lib/ai/compliance-output-schemas";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { aiRequestService } from "@/server/services/ai-request-service";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { complianceAgentService } from "@/server/services/compliance-agent-service";
import { brandService } from "@/server/services/workspace-service";

export const complianceReviewSuggestionService = {
  /** AI-assisted compliance review — suggestions only; never auto-blocks publication. */
  async suggest(
    brandId: string,
    organisationId: string,
    contentItemId: string,
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const item = await prisma.contentItem.findFirst({
      where: { id: contentItemId, organisationId, brandId, archivedAt: null },
      include: { variants: true },
    });
    if (!item) throw new AppError("NOT_FOUND", "Content item was not found.");

    const snapshot = await brandKnowledgeService.getSnapshot(brandId, organisationId, context);
    const brandContext = brandContextBuilder.build(snapshot, {});
    const contentText = [
      item.title,
      item.primaryMessage ?? "",
      ...item.variants.map((variant) => variant.caption ?? ""),
    ].join("\n");

    const evaluation = await complianceAgentService.evaluate(
      brandId,
      organisationId,
      contentItemId,
      context,
    );

    const result = await aiRequestService.executeStructured(
      {
        organisationId,
        projectId: brand.projectId,
        brandId,
        userProfileId: context.userProfileId,
        purpose: "COMPLIANCE_REVIEW_SUGGEST",
        templateKey: "compliance.review.suggest",
        userInput: [
          "Review this social content for brand safety and compliance risks.",
          "Return structured JSON only. Do not auto-approve content.",
          "",
          contentText,
        ].join("\n"),
        brandContext: brandContext as unknown as Record<string, unknown>,
        schemaKey: "complianceAiReview",
      },
      context,
    );

    const suggestion = complianceAiReviewSchema.parse(result.output);

    for (const aiFinding of suggestion.findings) {
      await prisma.complianceFinding.create({
        data: {
          evaluationId: evaluation.id,
          source: "AI",
          category: "BRAND",
          riskLevel: aiFinding.riskLevel === "BLOCKING" ? "HIGH" : aiFinding.riskLevel,
          isBlocking: false,
          status: "OPEN",
          excerpt: aiFinding.excerpt,
          message: aiFinding.explanation,
          explanation: aiFinding.explanation,
          suggestedCorrection: aiFinding.suggestedCorrection,
          ruleReference: aiFinding.ruleReference,
        },
      });
    }

    return {
      suggestion,
      aiRequestId: result.aiRequestId,
      evaluationId: evaluation.id,
      autoApplied: false as const,
      requiresHumanReview: true as const,
    };
  },
};
