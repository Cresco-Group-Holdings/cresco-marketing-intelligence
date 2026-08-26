import { ContentStudioType } from "@prisma/client";
import { contentStudioBriefOutputSchema } from "@/lib/ai/brief-output-schemas";
import { brandContextBuilder } from "@/lib/ai/brand-context-builder";
import {
  assertStudioGenerationNotInProgress,
  buildStudioGenerationRequestId,
  findCompletedAiRequestByRequestId,
} from "@/lib/content-studio/generation-tracking";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import type { z } from "zod";
import type {
  contentStudioGenerateBriefSchema,
  contentStudioRegenerateBriefSchema,
} from "@/lib/validation/content-studio";
import { aiRequestService } from "@/server/services/ai-request-service";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { contentStudioService } from "@/server/services/content-studio-service";
import { promptTemplateService } from "@/server/services/prompt-template-service";
import { brandService } from "@/server/services/workspace-service";

type BriefGenerationInput =
  | z.infer<typeof contentStudioGenerateBriefSchema>
  | z.infer<typeof contentStudioRegenerateBriefSchema>;

function assertBrandKnowledgeAvailable(snapshot: Awaited<ReturnType<typeof brandKnowledgeService.getSnapshot>>) {
  if (!snapshot.profile && !snapshot.messaging) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Brand Knowledge is insufficient for AI brief generation. Add brand profile or messaging first.",
    );
  }
}

export const contentStudioBriefAiService = {
  async createAndGenerateBrief(
    brandId: string,
    organisationId: string,
    input: z.infer<typeof contentStudioGenerateBriefSchema> & { studioType: ContentStudioType },
    context: TenantContext,
    requestId?: string,
  ) {
    const item = await contentStudioService.create(
      brandId,
      organisationId,
      {
        title: input.topic?.slice(0, 120) || "Untitled content",
        studioType: input.studioType,
        primaryChannel: input.primaryChannel,
      },
      context,
      requestId,
    );

    return this.generateBrief(brandId, organisationId, item.id, input, context, requestId);
  },

  async generateBrief(
    brandId: string,
    organisationId: string,
    contentId: string,
    input: BriefGenerationInput,
    context: TenantContext,
    requestId?: string,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const item = await contentStudioService.getById(brandId, organisationId, contentId, context);

    if (!["IDEA", "BRIEF"].includes(item.status)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "AI brief generation is only available for content in IDEA or BRIEF status.",
      );
    }

    const deterministicRequestId = buildStudioGenerationRequestId({
      organisationId,
      brandId,
      contentItemId: contentId,
      phase: "brief",
      idempotencyKey: input.idempotencyKey,
    });

    const cachedGeneration = item.provenance?.briefGeneration;
    if (
      cachedGeneration?.idempotencyKey === input.idempotencyKey &&
      cachedGeneration.status === "completed"
    ) {
      return {
        item,
        generation: {
          aiRequestId: cachedGeneration.aiRequestId!,
          idempotencyKey: input.idempotencyKey,
          cached: true,
        },
      };
    }

    await assertStudioGenerationNotInProgress(organisationId, deterministicRequestId);

    const completedRequest = await findCompletedAiRequestByRequestId(
      organisationId,
      deterministicRequestId,
    );
    if (completedRequest) {
      const structuredOutput = completedRequest.executions[0]?.structuredOutput;
      if (structuredOutput && typeof structuredOutput === "object" && !Array.isArray(structuredOutput)) {
        const parsed = contentStudioBriefOutputSchema.safeParse(structuredOutput);
        if (parsed.success) {
          const persisted = await contentStudioService.persistAiGeneratedBrief(
            brandId,
            organisationId,
            contentId,
            context,
            {
              output: parsed.data,
              idempotencyKey: input.idempotencyKey,
              aiRequestId: completedRequest.id,
              aiProvider: completedRequest.provider,
              aiModel: completedRequest.model,
              usedRecords: [],
              estimatedCostUsd: Number(completedRequest.estimatedCostUsd ?? 0),
            },
            requestId,
          );
          return {
            item: persisted,
            generation: {
              aiRequestId: completedRequest.id,
              idempotencyKey: input.idempotencyKey,
              cached: true,
            },
          };
        }
      }
    }

    const snapshot = await brandKnowledgeService.getSnapshot(brandId, organisationId, context);
    assertBrandKnowledgeAvailable(snapshot);

    const brandContext = brandContextBuilder.build(snapshot, {
      audienceId: input.audienceId,
      personaId: input.personaId,
      offerId: input.offerId,
      objectiveId: input.objectiveId,
    });

    const template = await promptTemplateService.getActiveTemplate("content.studio.brief.generate");

    try {
      await contentStudioService.markBriefGenerationInProgress(
        brandId,
        organisationId,
        contentId,
        context,
        { idempotencyKey: input.idempotencyKey, aiRequestId: deterministicRequestId },
      );

      const result = await aiRequestService.executeStructured(
        {
          organisationId,
          projectId: brand.projectId,
          brandId,
          userProfileId: context.userProfileId,
          purpose: "CONTENT_DRAFT",
          templateKey: "content.studio.brief.generate",
          requestId: deterministicRequestId,
          userInput: [
            "Generate a structured marketing content BRIEF only — do NOT write the full master content.",
            `Content studio type: ${item.studioType ?? "SOCIAL_POST"}`,
            input.topic ? `Topic / seed: ${input.topic}` : "Topic: derive from brand knowledge",
          ].join("\n"),
          brandContext: brandContext as unknown as Record<string, unknown>,
          schemaKey: "content.studio.brief.generate",
        },
        context,
      );

      const parsed = contentStudioBriefOutputSchema.parse(result.output);

      const persisted = await contentStudioService.persistAiGeneratedBrief(
        brandId,
        organisationId,
        contentId,
        context,
        {
          output: parsed,
          idempotencyKey: input.idempotencyKey,
          aiRequestId: result.aiRequestId,
          aiProvider: result.provider,
          aiModel: result.model,
          promptTemplateVersionId: template.activeVersion?.id,
          usedRecords: brandContext.usedRecords,
          estimatedCostUsd: result.estimatedCostUsd,
        },
        requestId,
      );

      return {
        item: persisted,
        generation: {
          aiRequestId: result.aiRequestId,
          idempotencyKey: input.idempotencyKey,
          estimatedCostUsd: result.estimatedCostUsd,
          provider: result.provider,
          model: result.model,
          cached: false,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI brief generation failed.";
      await contentStudioService.markBriefGenerationFailed(
        brandId,
        organisationId,
        contentId,
        context,
        {
          idempotencyKey: input.idempotencyKey,
          errorMessage: message,
        },
      );
      throw error;
    }
  },
};
