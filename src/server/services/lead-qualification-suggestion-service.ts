import { brandContextBuilder } from "@/lib/ai/brand-context-builder";
import { leadQualificationSuggestionSchema } from "@/lib/ai/leads-output-schemas";
import { QUALIFICATION_FIELDS } from "@/lib/leads/qualification-rules";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { aiRequestService } from "@/server/services/ai-request-service";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { brandService } from "@/server/services/workspace-service";

export const leadQualificationSuggestionService = {
  /**
   * Suggests qualification answers for human review — never auto-qualifies the lead.
   */
  async suggest(
    brandId: string,
    organisationId: string,
    leadId: string,
    input: { profile: import("@prisma/client").LeadQualificationProfile; instruction?: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const lead = await prisma.marketingLead.findFirst({
      where: { id: leadId, organisationId, brandId, status: { not: "DELETED" } },
      include: { source: true },
    });
    if (!lead) {
      throw new AppError("NOT_FOUND", "Lead was not found.");
    }

    const snapshot = await brandKnowledgeService.getSnapshot(brandId, organisationId, context);
    const brandContext = brandContextBuilder.build(snapshot, {});
    const fields = QUALIFICATION_FIELDS[input.profile]
      .map((field) => `- ${field.key}: ${field.label}`)
      .join("\n");

    const userInput = [
      input.instruction || "Suggest qualification answers based on the lead interaction.",
      "Return structured JSON only. Do not mark the lead as qualified without human review.",
      "",
      "Lead context:",
      `Display name: ${lead.displayName ?? "unknown"}`,
      `Company: ${lead.company ?? "unknown"}`,
      `Country: ${lead.country ?? "unknown"}`,
      `Interest: ${lead.expressedInterest ?? lead.originalInteraction ?? "unknown"}`,
      `Source: ${lead.source?.creationSource ?? "MANUAL"}`,
      "",
      "Qualification fields:",
      fields,
    ].join("\n");

    const result = await aiRequestService.executeStructured({
      organisationId,
      projectId: brand.projectId,
      brandId,
      userProfileId: context.userProfileId,
      purpose: "LEAD_QUALIFICATION_SUGGEST",
      templateKey: "leads.qualification.suggest",
      userInput,
      brandContext: brandContext as unknown as Record<string, unknown>,
      schemaKey: "leadQualificationSuggestion",
    }, context);

    const suggestion = leadQualificationSuggestionSchema.parse(result.output);

    return {
      suggestion: {
        ...suggestion,
        requiresHumanReview: true as const,
      },
      aiRequestId: result.aiRequestId,
      autoApplied: false as const,
    };
  },
};
