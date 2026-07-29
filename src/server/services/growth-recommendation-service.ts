import type {
  GrowthExperimentStatus,
  RecommendationDraftType,
  RecommendationFeedbackStatus,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { brandContextBuilder } from "@/lib/ai/brand-context-builder";
import type { GrowthInsightExplanation } from "@/lib/ai/growth-output-schemas";
import { INSUFFICIENT_DATA_MESSAGE } from "@/lib/growth/constants";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { aiRequestService } from "@/server/services/ai-request-service";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { contentService } from "@/server/services/content-service";
import { brandService } from "@/server/services/workspace-service";

function validateAiExplanation(
  explanation: GrowthInsightExplanation,
  allowedEvidenceKeys: Set<string>,
): void {
  for (const item of explanation.evidence) {
    if (!allowedEvidenceKeys.has(item.evidenceKey)) {
      throw new AppError(
        "VALIDATION_ERROR",
        `AI cited unsupported evidence key: ${item.evidenceKey}`,
      );
    }
  }

  const statPattern = /\b\d+(\.\d+)?%|\b\d{2,}\b/g;
  const combined = `${explanation.explanation} ${explanation.finding}`;
  const matches = combined.match(statPattern);
  if (matches && matches.length > 3) {
    throw new AppError(
      "VALIDATION_ERROR",
      "AI explanation contains unsupported statistics. Only reference supplied evidence.",
    );
  }
}

export const growthRecommendationService = {
  async list(
    brandId: string,
    organisationId: string,
    context: TenantContext,
    status: "ACTIVE" | "EXPIRED" | "SUPERSEDED" | "ALL" = "ACTIVE",
  ) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.growthRecommendation.findMany({
      where: {
        organisationId,
        brandId,
        ...(status !== "ALL" ? { status } : {}),
      },
      include: {
        growthInsight: { include: { evidence: true } },
        outcomes: { orderBy: { createdAt: "desc" }, take: 5 },
        experiments: true,
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
  },

  async getById(
    brandId: string,
    organisationId: string,
    recommendationId: string,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.growthRecommendation.findFirst({
      where: { id: recommendationId, organisationId, brandId },
      include: {
        growthInsight: { include: { evidence: true } },
        outcomes: { orderBy: { createdAt: "desc" } },
        experiments: true,
      },
    });
  },

  async recordFeedback(
    brandId: string,
    organisationId: string,
    recommendationId: string,
    input: {
      feedbackStatus: RecommendationFeedbackStatus;
      reason?: string;
      outcomeNotes?: string;
      measuredOutcome?: Record<string, unknown>;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const recommendation = await prisma.growthRecommendation.findFirst({
      where: { id: recommendationId, organisationId, brandId },
    });
    if (!recommendation) {
      throw new AppError("NOT_FOUND", "Recommendation not found.");
    }

    return prisma.recommendationOutcome.create({
      data: {
        organisationId,
        brandId,
        growthRecommendationId: recommendationId,
        userProfileId: context.userProfileId,
        feedbackStatus: input.feedbackStatus,
        reason: input.reason,
        outcomeNotes: input.outcomeNotes,
        measuredOutcome: input.measuredOutcome as Prisma.InputJsonValue,
      },
    });
  },

  async explainWithAi(
    brandId: string,
    organisationId: string,
    recommendationId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const recommendation = await prisma.growthRecommendation.findFirst({
      where: { id: recommendationId, organisationId, brandId },
      include: {
        growthInsight: { include: { evidence: true } },
      },
    });
    if (!recommendation) {
      throw new AppError("NOT_FOUND", "Recommendation not found.");
    }
    if (recommendation.growthInsight?.dataStatus === "INSUFFICIENT") {
      throw new AppError("VALIDATION_ERROR", INSUFFICIENT_DATA_MESSAGE);
    }

    const snapshot = await brandKnowledgeService.getSnapshot(brandId, organisationId, context);
    const brandContext = brandContextBuilder.build(snapshot, {});

    const evidencePayload = recommendation.growthInsight?.evidence ?? [];
    const allowedKeys = new Set(evidencePayload.map((e) => e.evidenceKey));

    const userInput = [
      "Explain the following deterministic growth insight. Do NOT invent statistics.",
      "Only reference the supplied metrics and evidence keys.",
      "",
      `Finding: ${recommendation.finding ?? recommendation.description}`,
      `Insight type: ${recommendation.insightType ?? "GENERAL"}`,
      `Source metrics: ${JSON.stringify(recommendation.growthInsight?.sourceMetrics ?? {})}`,
      `Evidence: ${JSON.stringify(evidencePayload.map((e) => ({ key: e.evidenceKey, label: e.evidenceLabel, value: e.evidenceValue })))}`,
      `Recommended action constraint: ${recommendation.recommendedAction ?? "Suggest a practical next step."}`,
    ].join("\n");

    const aiResult = await aiRequestService.executeStructured(
      {
        organisationId,
        projectId: brand.projectId,
        brandId,
        userProfileId: context.userProfileId,
        purpose: "ANALYTICS_INSIGHT",
        templateKey: "growth.insight.explain",
        schemaKey: "growth.insight.explain",
        provider: "MOCK",
        userInput,
        brandContext,
        requestId,
      },
      context,
    );

    validateAiExplanation(aiResult.output as GrowthInsightExplanation, allowedKeys);

    return prisma.growthRecommendation.update({
      where: { id: recommendationId },
      data: {
        finding: aiResult.output.finding,
        explanation: aiResult.output.explanation,
        recommendedAction: aiResult.output.recommendedAction,
        expectedHypothesis: aiResult.output.expectedHypothesis,
        measurementPlan: aiResult.output.measurementPlan,
        evidenceSummary: aiResult.output.evidence as Prisma.InputJsonValue,
        aiGenerated: true,
        aiRequestId: aiResult.requestId,
      },
      include: { growthInsight: { include: { evidence: true } }, outcomes: true },
    });
  },

  async createDraft(
    brandId: string,
    organisationId: string,
    recommendationId: string,
    input: {
      draftType: RecommendationDraftType;
      title?: string;
      socialAccountId?: string;
      scheduledFor?: string;
      timezone?: string;
    },
    context: TenantContext,
    requestId?: string,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const recommendation = await prisma.growthRecommendation.findFirst({
      where: { id: recommendationId, organisationId, brandId },
      include: { growthInsight: true },
    });
    if (!recommendation) {
      throw new AppError("NOT_FOUND", "Recommendation not found.");
    }

    const draftTitle = input.title ?? recommendation.title;

    if (input.draftType === "CONTENT_IDEA" || input.draftType === "STUDIO_BRIEF") {
      const content = await contentService.create(
        brandId,
        organisationId,
        {
          title: draftTitle,
          contentType: "TEXT_POST",
          primaryMessage: recommendation.recommendedAction ?? recommendation.description,
          campaignName: recommendation.growthInsight?.insightType,
        },
        context,
        requestId,
      );

      if (input.draftType === "STUDIO_BRIEF") {
        await prisma.contentProvenance.update({
          where: { contentItemId: content.id },
          data: {
            metadata: {
              growthBrief: true,
              recommendationId,
              measurementPlan: recommendation.measurementPlan,
              expectedHypothesis: recommendation.expectedHypothesis,
            },
          },
        });
      }

      await prisma.growthRecommendation.update({
        where: { id: recommendationId },
        data: { draftContentItemId: content.id },
      });

      return { draftType: input.draftType, contentItemId: content.id };
    }

    if (input.draftType === "EXPERIMENT") {
      const experiment = await prisma.growthExperiment.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          growthRecommendationId: recommendationId,
          title: draftTitle,
          hypothesis:
            recommendation.expectedHypothesis ??
            recommendation.recommendedAction ??
            recommendation.description,
          measurementPlan: recommendation.measurementPlan,
          status: "PLANNED",
          createdByUserId: context.userProfileId,
        },
      });

      await prisma.growthRecommendation.update({
        where: { id: recommendationId },
        data: { draftExperimentId: experiment.id },
      });

      return { draftType: input.draftType, experimentId: experiment.id };
    }

    if (input.draftType === "CALENDAR_PLACEHOLDER") {
      if (!input.socialAccountId || !input.scheduledFor || !input.timezone) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Calendar placeholder requires socialAccountId, scheduledFor, and timezone.",
        );
      }

      const content = await contentService.create(
        brandId,
        organisationId,
        {
          title: draftTitle,
          contentType: "TEXT_POST",
          primaryMessage: recommendation.recommendedAction ?? recommendation.description,
        },
        context,
        requestId,
      );

      const variant = await prisma.contentVariant.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          contentItemId: content.id,
          provider: (
            await prisma.socialAccount.findFirstOrThrow({
              where: { id: input.socialAccountId, organisationId, brandId },
            })
          ).provider,
          socialAccountId: input.socialAccountId,
          format: "TEXT_POST",
          status: "DRAFT",
        },
      });

      const schedule = await prisma.contentSchedule.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          contentItemId: content.id,
          contentVariantId: variant.id,
          socialAccountId: input.socialAccountId,
          scheduledFor: new Date(input.scheduledFor),
          timezone: input.timezone,
          status: "DRAFT",
          createdByUserId: context.userProfileId,
        },
      });

      await prisma.growthRecommendation.update({
        where: { id: recommendationId },
        data: { draftContentItemId: content.id },
      });

      return {
        draftType: input.draftType,
        contentItemId: content.id,
        scheduleId: schedule.id,
      };
    }

    throw new AppError("VALIDATION_ERROR", "Unsupported draft type.");
  },

  async listExperiments(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.growthExperiment.findMany({
      where: { organisationId, brandId },
      include: { growthRecommendation: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async updateExperiment(
    brandId: string,
    organisationId: string,
    experimentId: string,
    input: {
      status?: GrowthExperimentStatus;
      resultSummary?: string;
      startDate?: string;
      endDate?: string;
    },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const experiment = await prisma.growthExperiment.findFirst({
      where: { id: experimentId, organisationId, brandId },
    });
    if (!experiment) throw new AppError("NOT_FOUND", "Experiment not found.");

    return prisma.growthExperiment.update({
      where: { id: experimentId },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.resultSummary !== undefined ? { resultSummary: input.resultSummary } : {}),
        ...(input.startDate ? { startDate: new Date(input.startDate) } : {}),
        ...(input.endDate ? { endDate: new Date(input.endDate) } : {}),
      },
    });
  },
};
