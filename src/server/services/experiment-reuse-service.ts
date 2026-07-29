import type { ExperimentReuseType } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { ExperimentReuseInput } from "@/lib/validation/experiments";
import type { TenantContext } from "@/lib/tenancy/context";
import { socialExperimentService } from "@/server/services/social-experiment-service";

export const experimentReuseService = {
  async applyReuse(
    brandId: string,
    organisationId: string,
    experimentId: string,
    input: ExperimentReuseInput,
    context: TenantContext,
  ) {
    if (!input.confirmed) {
      throw new AppError("VALIDATION_ERROR", "User confirmation is required before reuse.");
    }

    const experiment = await socialExperimentService.getById(
      brandId,
      organisationId,
      experimentId,
      context,
    );
    if (!experiment.decision) {
      throw new AppError("VALIDATION_ERROR", "Compute results before reusing experiment findings.");
    }
    if (experiment.decision.outcome === "INCONCLUSIVE") {
      throw new AppError("VALIDATION_ERROR", "Inconclusive experiments cannot be reused.");
    }

    const winningVariant = experiment.variants.find(
      (variant) => variant.id === experiment.decision?.winningVariantId,
    );
    const summary =
      input.summary ??
      `Experiment "${experiment.title}" found a ${experiment.decision.outcome.toLowerCase()} on ${winningVariant?.label ?? "variant"}.`;

    let targetResourceType = "";
    let targetResourceId = "";

    switch (input.reuseType as ExperimentReuseType) {
      case "CONTENT_PATTERN": {
        const primaryMetric = experiment.metrics.find((metric) => metric.role === "PRIMARY");
        const pattern = await prisma.contentPattern.create({
          data: {
            organisationId,
            projectId: experiment.projectId,
            brandId,
            dimension: experiment.testType,
            dimensionValue: winningVariant?.label ?? "winner",
            metricKey: primaryMetric?.metricKey ?? "engagement_rate",
            metricValue: experiment.decision.percentageDifference ?? 0,
            sampleSize: experiment.minimumSampleThreshold,
            correlationNote:
              "Derived from a social content experiment. Observational comparison only; not proven causation.",
            periodStart: experiment.startDate,
            periodEnd: experiment.endDate,
            supportingContentIds: experiment.variants
              .map((variant) => variant.contentItemId)
              .filter((id): id is string => Boolean(id)),
            metadata: { socialExperimentId: experiment.id },
          },
        });
        targetResourceType = "ContentPattern";
        targetResourceId = pattern.id;
        break;
      }
      case "GROWTH_RECOMMENDATION": {
        const recommendation = await prisma.growthRecommendation.create({
          data: {
            organisationId,
            projectId: experiment.projectId,
            brandId,
            title: `Apply winning ${experiment.testType.toLowerCase()} from experiment`,
            description: summary,
            finding: experiment.hypothesis?.statement,
            recommendedAction: summary,
            expectedHypothesis: experiment.hypothesis?.statement,
            measurementPlan: experiment.decisionRule,
            evidenceSummary: experiment.validityWarnings as never,
            priority: 60,
          },
        });
        targetResourceType = "GrowthRecommendation";
        targetResourceId = recommendation.id;
        break;
      }
      case "BRAND_MESSAGING_NOTE": {
        const message = await prisma.brandMessage.findFirst({
          where: { organisationId, brandId },
        });
        if (!message) {
          throw new AppError("NOT_FOUND", "Brand messaging record was not found.");
        }
        const nextNotes = [message.coreMessage, `Experiment note: ${summary}`]
          .filter(Boolean)
          .join("\n\n");
        await prisma.brandMessage.update({
          where: { id: message.id },
          data: { coreMessage: nextNotes },
        });
        targetResourceType = "BrandMessage";
        targetResourceId = message.id;
        break;
      }
      case "CONTENT_STUDIO_GUIDANCE": {
        const contentItemId = winningVariant?.contentItemId;
        if (!contentItemId) {
          throw new AppError("VALIDATION_ERROR", "Winning variant must link to content for studio guidance.");
        }
        await prisma.contentProvenance.upsert({
          where: { contentItemId },
          create: {
            organisationId,
            projectId: experiment.projectId,
            brandId,
            contentItemId,
            createdManually: false,
            metadata: {
              socialExperimentId: experiment.id,
              guidance: summary,
            },
          },
          update: {
            metadata: {
              socialExperimentId: experiment.id,
              guidance: summary,
            },
          },
        });
        targetResourceType = "ContentProvenance";
        targetResourceId = contentItemId;
        break;
      }
      default:
        throw new AppError("VALIDATION_ERROR", "Unsupported reuse type.");
    }

    const record = await prisma.experimentReuseRecord.create({
      data: {
        socialExperimentId: experiment.id,
        reuseType: input.reuseType,
        targetResourceType,
        targetResourceId,
        summary,
        confirmedByUserId: context.userProfileId,
      },
    });

    return { record, targetResourceType, targetResourceId };
  },
};
