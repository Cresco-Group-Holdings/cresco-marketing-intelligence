import type {
  GrowthExperimentStatus,
  RecommendationDraftType,
  RecommendationFeedbackStatus,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { INSUFFICIENT_DATA_MESSAGE } from "@/lib/growth/constants";
import {
  assertFeedbackTransition,
  isDuplicateFeedback,
  requiresMeasuredOutcome,
} from "@/lib/growth/recommendation-lifecycle";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { contentService } from "@/server/services/content-service";
import { growthExplanationService } from "@/server/services/growth-explanation-service";
import { brandService } from "@/server/services/workspace-service";

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
      linkedExperimentId?: string;
    },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const recommendation = await prisma.growthRecommendation.findFirst({
      where: { id: recommendationId, organisationId, brandId },
    });
    if (!recommendation) {
      throw new AppError("NOT_FOUND", "Recommendation not found.");
    }
    if (recommendation.status !== "ACTIVE") {
      throw new AppError("VALIDATION_ERROR", "Feedback can only be recorded on active recommendations.");
    }

    if (isDuplicateFeedback(recommendation.latestFeedbackStatus, input.feedbackStatus)) {
      throw new AppError("VALIDATION_ERROR", "Duplicate feedback status is not allowed.");
    }
    assertFeedbackTransition(recommendation.latestFeedbackStatus, input.feedbackStatus);

    if (requiresMeasuredOutcome(input.feedbackStatus) && !input.measuredOutcome) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Measured outcome is required for SUCCESSFUL, UNSUCCESSFUL, and INCONCLUSIVE feedback.",
      );
    }

    const linkedExperimentId =
      input.linkedExperimentId ?? recommendation.draftExperimentId ?? undefined;

    return prisma.$transaction(async (tx) => {
      await tx.recommendationOutcome.updateMany({
        where: { growthRecommendationId: recommendationId, isEffective: true },
        data: { isEffective: false },
      });

      const outcome = await tx.recommendationOutcome.create({
        data: {
          organisationId,
          brandId,
          growthRecommendationId: recommendationId,
          userProfileId: context.userProfileId,
          feedbackStatus: input.feedbackStatus,
          reason: input.reason,
          outcomeNotes: input.outcomeNotes,
          measuredOutcome: input.measuredOutcome as Prisma.InputJsonValue,
          linkedExperimentId,
          isEffective: true,
        },
      });

      return tx.growthRecommendation.update({
        where: { id: recommendationId },
        data: {
          latestFeedbackStatus: input.feedbackStatus,
          latestOutcomeId: outcome.id,
        },
        include: { outcomes: { orderBy: { createdAt: "desc" } } },
      });
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

    const explanation = await growthExplanationService.explain(
      {
        brandId,
        organisationId,
        projectId: brand.projectId,
        recommendation,
      },
      context,
      requestId,
    );

    return prisma.growthRecommendation.update({
      where: { id: recommendationId },
      data: {
        finding: explanation.finding,
        explanation: explanation.explanation,
        recommendedAction: explanation.recommendedAction,
        expectedHypothesis: explanation.expectedHypothesis,
        measurementPlan: explanation.measurementPlan,
        evidenceSummary: explanation.evidence as Prisma.InputJsonValue,
        aiGenerated: explanation.aiGenerated,
        aiRequestId: explanation.aiRequestId,
        explanationSource: explanation.explanationSource,
      },
      include: { growthInsight: { include: { evidence: true } }, outcomes: true },
    });
  },

  async explainInsightWithAi(
    brandId: string,
    organisationId: string,
    insightId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const insight = await prisma.growthInsight.findFirst({
      where: { id: insightId, organisationId, brandId },
      include: {
        evidence: true,
        recommendations: { where: { status: "ACTIVE" }, take: 1 },
      },
    });
    if (!insight) throw new AppError("NOT_FOUND", "Insight not found.");
    if (insight.dataStatus === "INSUFFICIENT") {
      throw new AppError("VALIDATION_ERROR", INSUFFICIENT_DATA_MESSAGE);
    }

    const activeRecommendation = insight.recommendations[0];
    if (activeRecommendation) {
      return this.explainWithAi(
        brandId,
        organisationId,
        activeRecommendation.id,
        context,
        requestId,
      );
    }

    const synthetic = {
      id: insight.id,
      finding: insight.summary,
      description: insight.summary,
      recommendedAction: null,
      measurementPlan: null,
      expectedHypothesis: null,
      insightType: insight.insightType,
      growthInsight: insight,
    };

    const explanation = await growthExplanationService.explain(
      {
        brandId,
        organisationId,
        projectId: brand.projectId,
        recommendation: synthetic,
      },
      context,
      requestId,
    );

    return {
      insightId: insight.id,
      explanation,
    };
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
