import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { brandContextBuilder } from "@/lib/ai/brand-context-builder";
import { ADVERTISING_AUDIENCE_OUTPUT_SCHEMAS } from "@/lib/ai/advertising-audience-output-schemas";
import { detectSensitiveTargeting, hasBlockingSensitiveViolations } from "@/lib/advertising-audiences/sensitive-policy";
import type { TenantContext } from "@/lib/tenancy/context";
import { aiRequestService } from "@/server/services/ai-request-service";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { advertisingAudienceService } from "@/server/services/advertising-audience-service";

export const advertisingAudienceAiService = {
  async generatePlan(audienceId: string, brandId: string, organisationId: string, context: TenantContext) {
    const audience = await advertisingAudienceService.getById(audienceId, brandId, organisationId, context);
    const snapshot = await brandKnowledgeService.getSnapshot(brandId, organisationId, context);
    const brandContext = brandContextBuilder.build(snapshot, {});

    const result = await aiRequestService.executeStructured(
      {
        organisationId,
        projectId: audience.projectId ?? "",
        brandId,
        userProfileId: context.userProfileId,
        purpose: "ADVERTISING_AUDIENCE",
        templateKey: "advertising.audiences.plan",
        userInput: [
          `Propose audience plan for: ${audience.name}`,
          `Type: ${audience.audienceType}`,
          `Data sources: ${audience.dataSources.join(", ") || "not set"}`,
          "Do not recommend prohibited sensitive targeting.",
          "Do not fabricate provider reach estimates.",
        ].join("\n"),
        brandContext: brandContext as unknown as Record<string, unknown>,
        schemaKey: "advertising.audiences.plan",
      },
      context,
    );

    const sensitiveInOutput = detectSensitiveTargeting(
      JSON.stringify(result.output),
    );
    if (hasBlockingSensitiveViolations(sensitiveInOutput)) {
      result.output.prohibitedTargetingWarnings.push(
        ...sensitiveInOutput.map((v) => `Blocked: ${v.attribute}`),
      );
    }

    await prisma.advertisingAudience.update({
      where: { id: audienceId },
      data: {
        funnelStage: result.output.funnelStage,
        messageAngle: result.output.messageAngle,
      },
    });

    const versionNumber = (audience.versions[0]?.versionNumber ?? 0) + 1;
    await prisma.advertisingAudienceVersion.create({
      data: {
        organisationId,
        audienceId,
        versionNumber,
        status: audience.status,
        snapshot: result.output as Prisma.InputJsonValue,
        changeNote: "AI audience plan proposal",
        aiRequestId: result.aiRequestId,
        createdByUserId: context.userProfileId,
      },
    });

    return { output: result.output, sensitiveWarnings: sensitiveInOutput };
  },
};

void ADVERTISING_AUDIENCE_OUTPUT_SCHEMAS;
