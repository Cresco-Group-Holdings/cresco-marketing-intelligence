import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { ADVERTISING_PLAN_OUTPUT_SCHEMAS } from "@/lib/ai/advertising-plan-output-schemas";
import { brandContextBuilder } from "@/lib/ai/brand-context-builder";
import type { TenantContext } from "@/lib/tenancy/context";
import { aiRequestService } from "@/server/services/ai-request-service";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { advertisingCampaignPlanService } from "@/server/services/advertising-campaign-plan-service";

export const advertisingCampaignPlanAiService = {
  async generatePlan(
    planId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    const plan = await advertisingCampaignPlanService.getById(planId, brandId, organisationId, context);
    const snapshot = await brandKnowledgeService.getSnapshot(brandId, organisationId, context);
    const brandContext = brandContextBuilder.build(snapshot, {
      campaignObjective: plan.primaryObjective ?? undefined,
    });

    const result = await aiRequestService.executeStructured(
      {
        organisationId,
        projectId: plan.projectId,
        brandId,
        userProfileId: context.userProfileId,
        purpose: "ADVERTISING_PLANNING",
        templateKey: "advertising.plans.generate",
        userInput: `Generate a campaign plan proposal for: ${plan.name}. Description: ${plan.description ?? "N/A"}. Objective: ${plan.primaryObjective ?? "not set"}. Do not fabricate forecasts or guaranteed results.`,
        brandContext: brandContext as unknown as Record<string, unknown>,
        schemaKey: "advertising.plans.generate",
      },
      context,
    );

    const versionNumber = (plan.versions[0]?.versionNumber ?? 0) + 1;
    const version = await prisma.advertisingCampaignPlanVersion.create({
      data: {
        organisationId,
        planId,
        versionNumber,
        status: plan.status,
        structuredOutput: result.output as Prisma.InputJsonValue,
        evidenceSummary: { evidence: result.output.evidence } as Prisma.InputJsonValue,
        assumptions: { items: result.output.assumptions } as Prisma.InputJsonValue,
        limitations: result.output.disclaimer,
        aiRequestId: result.aiRequestId,
        aiModel: result.model,
        aiProvider: result.provider,
        createdByUserId: context.userProfileId,
      },
    });

    await prisma.advertisingCampaignPlan.update({
      where: { id: planId },
      data: { status: "PLANNING", currentVersionId: version.id },
    });

    return { version, output: result.output };
  },
};

// Ensure schema is registered at module load
void ADVERTISING_PLAN_OUTPUT_SCHEMAS;
