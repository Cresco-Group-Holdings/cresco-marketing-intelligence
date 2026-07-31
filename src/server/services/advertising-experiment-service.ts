import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { analyzeExperiment, formatAnalysisDisclaimer } from "@/lib/advertising-experiments/analysis";
import { buildAllocationPlan } from "@/lib/advertising-experiments/allocation";
import {
  FEATURE_FLAGGED_EXPERIMENT_TYPES,
  RANDOMISATION_DISCLAIMER,
} from "@/lib/advertising-experiments/constants";
import { requiresHumanApproval, validateDecision } from "@/lib/advertising-experiments/decisions";
import { validateHypothesis, type HypothesisInput } from "@/lib/advertising-experiments/hypothesis";
import { validateMetrics, type MetricDefinition } from "@/lib/advertising-experiments/metrics";
import { assessAdvertisingExperimentValidity, hasCriticalValidityIssues } from "@/lib/advertising-experiments/validity";
import { checkVariantIsolation, validateVariants, type VariantInput } from "@/lib/advertising-experiments/variants";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

const experimentInclude = {
  hypothesis: true,
  variants: { orderBy: { sortOrder: "asc" as const } },
  allocations: { orderBy: { createdAt: "desc" as const }, take: 1 },
  metrics: { orderBy: [{ role: "asc" as const }, { metricKey: "asc" as const }] },
  observations: { orderBy: { observedAt: "desc" as const } },
  results: true,
  validityChecks: { orderBy: { detectedAt: "desc" as const } },
  decision: true,
  versions: { orderBy: { versionNumber: "desc" as const }, take: 5 },
  plan: { select: { id: true, name: true } },
} satisfies Prisma.AdvertisingExperimentInclude;

export type CreateExperimentInput = {
  title: string;
  experimentType: string;
  provider?: string;
  planId?: string;
  startDate?: string;
  endDate?: string;
  hypothesis: HypothesisInput;
  variants: VariantInput[];
  metrics: MetricDefinition[];
  allocation: { allocationType: string; weights?: Record<string, number> };
};

export const advertisingExperimentService = {
  async list(brandId: string, organisationId: string, context: TenantContext, filters?: { status?: string }) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingExperiment.findMany({
      where: {
        organisationId,
        brandId,
        ...(filters?.status ? { status: filters.status as Prisma.EnumAdvertisingExperimentStatusFilter["equals"] } : {}),
      },
      include: experimentInclude,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },

  async getById(experimentId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const experiment = await prisma.advertisingExperiment.findFirst({
      where: { id: experimentId, organisationId, brandId },
      include: experimentInclude,
    });
    if (!experiment) throw new AppError("NOT_FOUND", "Experiment not found.");
    return experiment;
  },

  async create(brandId: string, organisationId: string, input: CreateExperimentInput, context: TenantContext) {
    const brand = await brandService.getById(brandId, organisationId, context);

    if ((FEATURE_FLAGGED_EXPERIMENT_TYPES as readonly string[]).includes(input.experimentType)) {
      throw new AppError("VALIDATION_ERROR", `${input.experimentType} experiments are behind feature flags and read-only.`);
    }

    const hypothesisValidation = validateHypothesis(input.hypothesis);
    if (!hypothesisValidation.valid) {
      throw new AppError("VALIDATION_ERROR", hypothesisValidation.errors.join(" "));
    }

    const variantValidation = validateVariants(input.variants, input.experimentType);
    if (!variantValidation.valid) {
      throw new AppError("VALIDATION_ERROR", variantValidation.errors.join(" "));
    }

    const metricValidation = validateMetrics(input.metrics);
    if (!metricValidation.valid) {
      throw new AppError("VALIDATION_ERROR", metricValidation.errors.join(" "));
    }

    const isolationIssues = checkVariantIsolation(input.variants);

    return prisma.advertisingExperiment.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        planId: input.planId,
        title: input.title,
        status: "DRAFT",
        experimentType: input.experimentType as Prisma.AdvertisingExperimentCreateInput["experimentType"],
        provider: input.provider,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        createdByUserId: context.userProfileId,
        hypothesis: {
          create: {
            observedProblem: input.hypothesis.observedProblem,
            proposedChange: input.hypothesis.proposedChange,
            expectedOutcome: input.hypothesis.expectedOutcome,
            primaryMetric: input.hypothesis.primaryMetric,
            guardrailMetrics: input.hypothesis.guardrailMetrics ?? [],
            audience: input.hypothesis.audience,
            durationDays: input.hypothesis.durationDays,
            minimumVolume: input.hypothesis.minimumVolume,
            decisionRule: input.hypothesis.decisionRule,
          },
        },
        variants: {
          create: input.variants.map((v, i) => ({
            variantType: v.variantType as Prisma.AdvertisingExperimentVariantCreateWithoutExperimentInput["variantType"],
            label: v.label,
            sortOrder: v.sortOrder ?? i,
            documentedVariables: v.documentedVariables as Prisma.InputJsonValue,
            providerCampaignId: v.providerCampaignId,
            providerAdSetId: v.providerAdSetId,
            providerAdId: v.providerAdId,
            internalCreativeId: v.internalCreativeId,
            providerResourceIds: v.providerResourceIds as Prisma.InputJsonValue,
          })),
        },
        metrics: {
          create: input.metrics.map((m) => ({
            metricKey: m.metricKey,
            role: m.role,
            label: m.label,
            attributionDefinition: m.attributionDefinition,
            providerMetricName: m.providerMetricName,
          })),
        },
        versions: {
          create: {
            versionNumber: 1,
            changeSummary: "Initial experiment design",
            snapshot: { isolationIssues } as Prisma.InputJsonValue,
            createdByUserId: context.userProfileId,
          },
        },
      },
      include: experimentInclude,
    });
  },

  async setAllocation(experimentId: string, brandId: string, organisationId: string, allocation: { allocationType: string; weights?: Record<string, number> }, context: TenantContext) {
    const experiment = await this.getById(experimentId, brandId, organisationId, context);
    const plan = buildAllocationPlan(
      experiment.variants.map((v) => v.id),
      allocation,
    );

    return prisma.advertisingExperimentAllocation.create({
      data: {
        experimentId,
        allocationType: allocation.allocationType as Prisma.AdvertisingExperimentAllocationCreateInput["allocationType"],
        weights: plan.weights as Prisma.InputJsonValue,
        providerNativeSplit: plan.providerNativeSplit,
        randomisationDisclaimer: plan.randomisationDisclaimer,
        effectiveFrom: new Date(),
      },
    });
  },

  async markReady(experimentId: string, brandId: string, organisationId: string, context: TenantContext) {
    const experiment = await this.getById(experimentId, brandId, organisationId, context);
    if (experiment.status !== "DRAFT") throw new AppError("VALIDATION_ERROR", "Only draft experiments can be marked ready.");
    if (!experiment.hypothesis) throw new AppError("VALIDATION_ERROR", "Measurable hypothesis is required.");
    if (experiment.variants.length < 2) throw new AppError("VALIDATION_ERROR", "At least two variants required.");
    if (!experiment.metrics.some((m) => m.role === "PRIMARY")) throw new AppError("VALIDATION_ERROR", "Primary metric required.");

    if (!experiment.allocations.length) {
      await this.setAllocation(experimentId, brandId, organisationId, { allocationType: "EQUAL" }, context);
    }

    return prisma.advertisingExperiment.update({
      where: { id: experimentId },
      data: { status: "READY" },
      include: experimentInclude,
    });
  },

  async start(experimentId: string, brandId: string, organisationId: string, context: TenantContext) {
    const experiment = await this.getById(experimentId, brandId, organisationId, context);
    if (experiment.status !== "READY") throw new AppError("VALIDATION_ERROR", "Only ready experiments can be started.");
    return prisma.advertisingExperiment.update({
      where: { id: experimentId },
      data: { status: "RUNNING", startDate: experiment.startDate ?? new Date() },
      include: experimentInclude,
    });
  },

  async recordObservations(
    experimentId: string,
    brandId: string,
    organisationId: string,
    observations: Array<{ variantId: string; metricKey: string; rawValue: number; sampleSize: number; observedAt?: string; isStale?: boolean }>,
    context: TenantContext,
  ) {
    await this.getById(experimentId, brandId, organisationId, context);

    const created = [];
    for (const obs of observations) {
      created.push(
        await prisma.advertisingExperimentObservation.create({
          data: {
            experimentId,
            variantId: obs.variantId,
            metricKey: obs.metricKey,
            rawValue: obs.rawValue,
            sampleSize: obs.sampleSize,
            observedAt: obs.observedAt ? new Date(obs.observedAt) : new Date(),
            isStale: obs.isStale ?? false,
            dataSource: "provider_reporting",
          },
        }),
      );
    }
    return created;
  },

  async runValidityChecks(experimentId: string, brandId: string, organisationId: string, context: TenantContext) {
    const experiment = await this.getById(experimentId, brandId, organisationId, context);
    const hypothesis = experiment.hypothesis;
    if (!hypothesis) throw new AppError("VALIDATION_ERROR", "Hypothesis required.");

    const variantSampleSizes: Record<string, number> = {};
    const variantDelivered: Record<string, boolean> = {};
    for (const variant of experiment.variants) {
      const obs = experiment.observations.filter((o) => o.variantId === variant.id);
      variantSampleSizes[variant.id] = obs.reduce((sum, o) => sum + o.sampleSize, 0);
      variantDelivered[variant.id] = obs.length > 0;
    }

    const allocation = experiment.allocations[0];
    const checks = assessAdvertisingExperimentValidity({
      minimumVolume: hypothesis.minimumVolume,
      allocationType: allocation?.allocationType ?? "EQUAL",
      variantSampleSizes,
      variantDelivered,
      hasStaleObservations: experiment.observations.some((o) => o.isStale),
      campaignChangedDuringTest: false,
      audienceOverlapDetected: false,
      trackingFailure: false,
      inconsistentAttribution: false,
      missingConversionData: false,
      majorBudgetChange: false,
      earlyStoppingRisk: experiment.status === "COMPLETED",
      testDurationDays: experiment.startDate
        ? Math.ceil((Date.now() - experiment.startDate.getTime()) / 86_400_000)
        : 0,
      plannedDurationDays: hypothesis.durationDays,
    });

    await prisma.advertisingExperimentValidityCheck.deleteMany({ where: { experimentId } });
    for (const check of checks) {
      await prisma.advertisingExperimentValidityCheck.create({
        data: {
          experimentId,
          checkType: check.checkType,
          severity: check.severity,
          message: check.message,
          metadata: check.metadata as Prisma.InputJsonValue,
        },
      });
    }

    return checks;
  },

  async analyze(experimentId: string, brandId: string, organisationId: string, context: TenantContext) {
    const experiment = await this.getById(experimentId, brandId, organisationId, context);
    const hypothesis = experiment.hypothesis;
    if (!hypothesis) throw new AppError("VALIDATION_ERROR", "Hypothesis required.");

    const validityChecks = await this.runValidityChecks(experimentId, brandId, organisationId, context);
    const refreshed = await this.getById(experimentId, brandId, organisationId, context);

    const variantValues = refreshed.variants.flatMap((variant) => {
      const latestObs = refreshed.observations
        .filter((o) => o.variantId === variant.id && o.metricKey === hypothesis.primaryMetric)
        .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime())[0];
      if (!latestObs) return [];
      return [{
        variantId: variant.id,
        label: variant.label,
        metricKey: hypothesis.primaryMetric,
        absoluteValue: Number(latestObs.rawValue),
        sampleSize: latestObs.sampleSize,
      }];
    });

    const analysis = analyzeExperiment({
      primaryMetricKey: hypothesis.primaryMetric,
      variantValues,
      validityChecks: refreshed.validityChecks.map((c) => ({
        checkType: c.checkType,
        severity: c.severity,
        message: c.message,
      })),
      testDurationDays: refreshed.startDate
        ? Math.ceil((Date.now() - refreshed.startDate.getTime()) / 86_400_000)
        : 0,
      minimumVolume: hypothesis.minimumVolume,
      decisionRule: hypothesis.decisionRule,
    });

    for (const vv of variantValues) {
      await prisma.advertisingExperimentResult.upsert({
        where: { variantId_metricKey: { variantId: vv.variantId, metricKey: vv.metricKey } },
        create: {
          experimentId,
          variantId: vv.variantId,
          metricKey: vv.metricKey,
          absoluteValue: vv.absoluteValue,
          relativeDifference: analysis.relativeDifference,
          sampleSize: vv.sampleSize,
          confidenceMethod: analysis.confidenceMethod,
          uncertaintyLower: analysis.uncertaintyLower,
          uncertaintyUpper: analysis.uncertaintyUpper,
        },
        update: {
          absoluteValue: vv.absoluteValue,
          relativeDifference: analysis.relativeDifference,
          sampleSize: vv.sampleSize,
          confidenceMethod: analysis.confidenceMethod,
          uncertaintyLower: analysis.uncertaintyLower,
          uncertaintyUpper: analysis.uncertaintyUpper,
          computedAt: new Date(),
        },
      });
    }

    return {
      analysis: {
        ...analysis,
        disclaimer: formatAnalysisDisclaimer(analysis.significanceClaimed),
        randomisationDisclaimer: RANDOMISATION_DISCLAIMER,
      },
      validityChecks: refreshed.validityChecks,
      results: await prisma.advertisingExperimentResult.findMany({ where: { experimentId } }),
    };
  },

  async recordDecision(
    experimentId: string,
    brandId: string,
    organisationId: string,
    input: { outcome: string; winningVariantId?: string; recommendation: string; limitations: string },
    context: TenantContext,
  ) {
    const experiment = await this.getById(experimentId, brandId, organisationId, context);
    const analysisResult = await this.analyze(experimentId, brandId, organisationId, context);

    const validation = validateDecision({
      ...input,
      analysisSignificanceClaimed: analysisResult.analysis.significanceClaimed,
    });
    if (!validation.valid) throw new AppError("VALIDATION_ERROR", validation.errors.join(" "));

    if (hasCriticalValidityIssues(analysisResult.validityChecks.map((c) => ({
      checkType: c.checkType,
      severity: c.severity,
      message: c.message,
    }))) && input.outcome === "ADOPT_VARIANT") {
      throw new AppError("VALIDATION_ERROR", "Cannot adopt variant when critical validity issues exist.");
    }

    const decision = await prisma.advertisingExperimentDecision.upsert({
      where: { experimentId },
      create: {
        experimentId,
        outcome: input.outcome as Prisma.AdvertisingExperimentDecisionCreateInput["outcome"],
        winningVariantId: input.winningVariantId,
        recommendation: input.recommendation,
        limitations: input.limitations,
        confidenceNote: analysisResult.analysis.disclaimer,
        decidedByUserId: context.userProfileId,
      },
      update: {
        outcome: input.outcome as Prisma.AdvertisingExperimentDecisionUpdateInput["outcome"],
        winningVariantId: input.winningVariantId,
        recommendation: input.recommendation,
        limitations: input.limitations,
        decidedByUserId: context.userProfileId,
        decidedAt: new Date(),
        approvedByUserId: null,
        approvedAt: null,
      },
    });

    const nextStatus =
      input.outcome === "ADOPT_VARIANT" || input.outcome === "KEEP_CONTROL" ? "COMPLETED"
      : input.outcome === "INVALID_TEST" ? "INCONCLUSIVE"
      : input.outcome === "CONTINUE_TEST" ? "RUNNING"
      : "COMPLETED";

    await prisma.advertisingExperiment.update({
      where: { id: experimentId },
      data: { status: nextStatus },
    });

    return decision;
  },

  async approveDecision(experimentId: string, brandId: string, organisationId: string, context: TenantContext) {
    const experiment = await this.getById(experimentId, brandId, organisationId, context);
    if (!experiment.decision) throw new AppError("NOT_FOUND", "No decision to approve.");
    if (!requiresHumanApproval(experiment.decision.outcome)) {
      throw new AppError("VALIDATION_ERROR", "This outcome does not require approval.");
    }
    if (experiment.decision.approvedAt) {
      throw new AppError("VALIDATION_ERROR", "Decision already approved.");
    }

    return prisma.advertisingExperimentDecision.update({
      where: { experimentId },
      data: {
        approvedByUserId: context.userProfileId,
        approvedAt: new Date(),
      },
    });
  },
};
