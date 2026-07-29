import type { Prisma, SocialExperimentStatus } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { concludeExperiment, normaliseMetric } from "@/lib/experiments/conclusions";
import { OBSERVATIONAL_DISCLAIMER } from "@/lib/experiments/constants";
import { assessExperimentValidity } from "@/lib/experiments/validity";
import { AppError } from "@/lib/errors";
import type {
  ExperimentCreateInput,
  ExperimentListFilters,
  ExperimentUpdateInput,
} from "@/lib/validation/experiments";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

const experimentInclude = {
  hypothesis: true,
  variants: { orderBy: { sortOrder: "asc" as const } },
  metrics: { orderBy: [{ role: "asc" as const }, { metricKey: "asc" as const }] },
  results: true,
  decision: true,
  reuseRecords: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.SocialExperimentInclude;

function parseWarnings(value: Prisma.JsonValue) {
  return Array.isArray(value) ? value : [];
}

export const socialExperimentService = {
  async list(
    brandId: string,
    organisationId: string,
    filters: ExperimentListFilters,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.socialExperiment.findMany({
      where: {
        organisationId,
        brandId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.testType ? { testType: filters.testType } : {}),
      },
      include: experimentInclude,
      orderBy: { createdAt: "desc" },
      take: filters.limit,
    });
  },

  async getById(
    brandId: string,
    organisationId: string,
    experimentId: string,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const experiment = await prisma.socialExperiment.findFirst({
      where: { id: experimentId, organisationId, brandId },
      include: experimentInclude,
    });
    if (!experiment) throw new AppError("NOT_FOUND", "Experiment was not found.");
    return experiment;
  },

  async create(
    brandId: string,
    organisationId: string,
    input: ExperimentCreateInput,
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    if (endDate <= startDate) {
      throw new AppError("VALIDATION_ERROR", "End date must be after start date.");
    }

    const variantData = input.variants.map((variant, index) => ({
      label: variant.label,
      contentItemId: variant.contentItemId,
      contentVariantId: variant.contentVariantId,
      provider: variant.provider ?? input.targetProvider,
      scheduledFor: variant.scheduledFor ? new Date(variant.scheduledFor) : null,
      publishedAt: variant.publishedAt ? new Date(variant.publishedAt) : null,
      hasPaidPromotion: variant.hasPaidPromotion ?? false,
      contentTopic: variant.contentTopic,
      hookText: variant.hookText,
      captionText: variant.captionText,
      ctaText: variant.ctaText,
      contentPillar: variant.contentPillar,
      sortOrder: variant.sortOrder ?? index,
    }));

    const validityWarnings = assessExperimentValidity({
      targetProvider: input.targetProvider,
      minimumSampleThreshold: input.minimumSampleThreshold,
      variants: variantData,
    });

    return prisma.socialExperiment.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        title: input.title,
        status: "DRAFT",
        testType: input.testType,
        mode: input.mode,
        targetProvider: input.targetProvider,
        startDate,
        endDate,
        minimumSampleThreshold: input.minimumSampleThreshold,
        decisionRule: input.decisionRule,
        confoundingFactorNotes: input.confoundingFactorNotes,
        validityWarnings: validityWarnings as unknown as Prisma.InputJsonValue,
        observationalDisclaimer: OBSERVATIONAL_DISCLAIMER,
        createdByUserId: context.userProfileId,
        hypothesis: {
          create: {
            statement: input.hypothesis.statement,
            expectedDirection: input.hypothesis.expectedDirection,
            rationale: input.hypothesis.rationale,
          },
        },
        variants: { create: variantData },
        metrics: {
          create: input.metrics.map((metric) => ({
            metricKey: metric.metricKey,
            role: metric.role,
            label: metric.label,
            normalisationMethod: metric.normalisationMethod ?? "none",
          })),
        },
      },
      include: experimentInclude,
    });
  },

  async update(
    brandId: string,
    organisationId: string,
    experimentId: string,
    input: ExperimentUpdateInput,
    context: TenantContext,
  ) {
    const experiment = await this.getById(brandId, organisationId, experimentId, context);
    if (experiment.status === "CANCELLED") {
      throw new AppError("VALIDATION_ERROR", "Cancelled experiments cannot be updated.");
    }

    const nextStatus = input.status;
    if (nextStatus === "RUNNING" && !["READY", "RUNNING"].includes(experiment.status)) {
      throw new AppError("VALIDATION_ERROR", "Only ready experiments can be started.");
    }
    if (nextStatus === "COMPLETED" && experiment.status !== "RUNNING") {
      throw new AppError("VALIDATION_ERROR", "Only running experiments can be completed.");
    }

    return prisma.socialExperiment.update({
      where: { id: experimentId },
      data: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.startDate ? { startDate: new Date(input.startDate) } : {}),
        ...(input.endDate ? { endDate: new Date(input.endDate) } : {}),
        ...(input.minimumSampleThreshold !== undefined
          ? { minimumSampleThreshold: input.minimumSampleThreshold }
          : {}),
        ...(input.decisionRule ? { decisionRule: input.decisionRule } : {}),
        ...(input.confoundingFactorNotes !== undefined
          ? { confoundingFactorNotes: input.confoundingFactorNotes }
          : {}),
        ...(nextStatus ? { status: nextStatus as SocialExperimentStatus } : {}),
        ...(nextStatus === "CANCELLED"
          ? {
              status: "CANCELLED",
              cancelledAt: new Date(),
              cancelledReason: input.cancelledReason ?? "Cancelled by user.",
            }
          : {}),
      },
      include: experimentInclude,
    });
  },

  async markReady(brandId: string, organisationId: string, experimentId: string, context: TenantContext) {
    const experiment = await this.getById(brandId, organisationId, experimentId, context);
    if (experiment.status !== "DRAFT") {
      throw new AppError("VALIDATION_ERROR", "Only draft experiments can be marked ready.");
    }
    if (experiment.variants.length < 2) {
      throw new AppError("VALIDATION_ERROR", "At least two variants are required.");
    }
    if (!experiment.metrics.some((metric) => metric.role === "PRIMARY")) {
      throw new AppError("VALIDATION_ERROR", "A primary metric is required.");
    }
    return prisma.socialExperiment.update({
      where: { id: experimentId },
      data: { status: "READY" },
      include: experimentInclude,
    });
  },

  async computeResults(
    brandId: string,
    organisationId: string,
    experimentId: string,
    context: TenantContext,
  ) {
    const experiment = await this.getById(brandId, organisationId, experimentId, context);
    const primaryMetric = experiment.metrics.find((metric) => metric.role === "PRIMARY");
    if (!primaryMetric) {
      throw new AppError("VALIDATION_ERROR", "Primary metric is required.");
    }

    const computedResults: Awaited<ReturnType<typeof prisma.experimentResult.upsert>>[] = [];
    const sampleSizes: Record<string, number> = {};

    for (const variant of experiment.variants) {
      for (const metric of experiment.metrics) {
        const metrics = await prisma.socialPostMetric.findMany({
          where: {
            organisationId,
            brandId,
            metricType: metric.metricKey,
            ...(variant.contentItemId ? { contentItemId: variant.contentItemId } : {}),
            ...(variant.contentVariantId ? { contentVariantId: variant.contentVariantId } : {}),
            measuredAt: { gte: experiment.startDate, lte: experiment.endDate },
          },
        });

        const rawValue = metrics.reduce((sum, row) => sum + Number(row.metricValue), 0);
        const sampleSize = metrics.length;
        sampleSizes[variant.id] = Math.max(sampleSizes[variant.id] ?? 0, sampleSize);
        const dataSufficient = sampleSize >= experiment.minimumSampleThreshold;
        const normalisedValue = normaliseMetric(rawValue, sampleSize, metric.normalisationMethod);

        const saved = await prisma.experimentResult.upsert({
          where: {
            experimentVariantId_metricKey: {
              experimentVariantId: variant.id,
              metricKey: metric.metricKey,
            },
          },
          create: {
            socialExperimentId: experiment.id,
            experimentVariantId: variant.id,
            metricKey: metric.metricKey,
            rawValue,
            normalisedValue,
            sampleSize,
            dataSufficient,
          },
          update: {
            rawValue,
            normalisedValue,
            sampleSize,
            dataSufficient,
            computedAt: new Date(),
          },
        });
        computedResults.push(saved);
      }
    }

    const validityWarnings = assessExperimentValidity({
      targetProvider: experiment.targetProvider,
      minimumSampleThreshold: experiment.minimumSampleThreshold,
      variants: experiment.variants,
      sampleSizes,
    });

    await prisma.socialExperiment.update({
      where: { id: experiment.id },
      data: { validityWarnings: validityWarnings as unknown as Prisma.InputJsonValue },
    });

    const variantResults = experiment.variants.flatMap((variant) =>
      experiment.metrics.map((metric) => {
        const result = computedResults.find(
          (row) => row.experimentVariantId === variant.id && row.metricKey === metric.metricKey,
        );
        return {
          variantId: variant.id,
          label: variant.label,
          metricKey: metric.metricKey,
          rawValue: Number(result?.rawValue ?? 0),
          normalisedValue: result?.normalisedValue ? Number(result.normalisedValue) : null,
          sampleSize: result?.sampleSize ?? 0,
          dataSufficient: result?.dataSufficient ?? false,
        };
      }),
    );

    const conclusion = concludeExperiment({
      primaryMetricKey: primaryMetric.metricKey,
      minimumSampleThreshold: experiment.minimumSampleThreshold,
      variantResults,
      validityWarnings,
      decisionRule: experiment.decisionRule,
    });

    const status: SocialExperimentStatus = conclusion.outcome === "INCONCLUSIVE"
      ? "INCONCLUSIVE"
      : experiment.status === "RUNNING"
        ? "COMPLETED"
        : experiment.status;

    await prisma.experimentDecision.upsert({
      where: { socialExperimentId: experiment.id },
      create: {
        socialExperimentId: experiment.id,
        outcome: conclusion.outcome,
        winningVariantId: conclusion.winningVariantId,
        absoluteDifference: conclusion.absoluteDifference,
        percentageDifference: conclusion.percentageDifference,
        limitations: conclusion.limitations.join(" "),
        decidedByUserId: context.userProfileId,
      },
      update: {
        outcome: conclusion.outcome,
        winningVariantId: conclusion.winningVariantId,
        absoluteDifference: conclusion.absoluteDifference,
        percentageDifference: conclusion.percentageDifference,
        limitations: conclusion.limitations.join(" "),
        decidedAt: new Date(),
        decidedByUserId: context.userProfileId,
      },
    });

    if (status !== experiment.status) {
      await prisma.socialExperiment.update({
        where: { id: experiment.id },
        data: { status },
      });
    }

    return {
      results: computedResults,
      validityWarnings,
      conclusion,
      warnings: parseWarnings(experiment.validityWarnings),
    };
  },
};
