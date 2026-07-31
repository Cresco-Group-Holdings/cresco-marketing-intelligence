import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import type { AnalysisInput } from "@/lib/advertising-optimisation/analysis-inputs";
import { runOptimisationAnalysis } from "@/lib/advertising-optimisation/analyzer";
import { evaluateActionProposal, canApplyAction } from "@/lib/advertising-optimisation/actions";
import { validateFeedback, recordOutcome, canClaimSuccess } from "@/lib/advertising-optimisation/feedback";
import { blockAutonomousSpendIncrease } from "@/lib/advertising-optimisation/guardrails";
import { mapRecommendationToActionClass } from "@/lib/advertising-optimisation/recommendations";
import { MINIMUM_VOLUME_DEFAULT } from "@/lib/advertising-optimisation/constants";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

const runInclude = {
  evidence: true,
  findings: true,
  recommendations: {
    include: {
      actionProposals: { include: { approvals: true } },
      feedback: true,
      outcomes: true,
      finding: true,
    },
  },
  initiatedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.AdvertisingOptimisationRunInclude;

export type StartRunInput = {
  reviewType: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  comparisonPeriodStart?: string;
  comparisonPeriodEnd?: string;
  provider?: string;
  accountId?: string;
  campaignId?: string;
  analysis: Partial<AnalysisInput>;
};

export const advertisingOptimisationService = {
  async listRuns(brandId: string, organisationId: string, context: TenantContext, filters?: { reviewType?: string }) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingOptimisationRun.findMany({
      where: {
        organisationId,
        brandId,
        ...(filters?.reviewType
          ? { reviewType: filters.reviewType as Prisma.EnumAdvertisingOptimisationReviewTypeFilter["equals"] }
          : {}),
      },
      include: runInclude,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },

  async getRun(runId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const run = await prisma.advertisingOptimisationRun.findFirst({
      where: { id: runId, organisationId, brandId },
      include: runInclude,
    });
    if (!run) throw new AppError("NOT_FOUND", "Optimisation run not found.");
    return run;
  },

  async getRecommendation(recommendationId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const recommendation = await prisma.advertisingOptimisationRecommendation.findFirst({
      where: { id: recommendationId, run: { organisationId, brandId } },
      include: {
        run: { include: { evidence: true } },
        finding: true,
        actionProposals: { include: { approvals: true, outcomes: true } },
        feedback: { include: { user: { select: { id: true, displayName: true } } } },
        outcomes: true,
      },
    });
    if (!recommendation) throw new AppError("NOT_FOUND", "Recommendation not found.");
    return recommendation;
  },

  async startRun(brandId: string, organisationId: string, input: StartRunInput, context: TenantContext) {
    const brand = await brandService.getById(brandId, organisationId, context);

    const analysisInput: AnalysisInput = {
      dateRangeStart: new Date(input.dateRangeStart),
      dateRangeEnd: new Date(input.dateRangeEnd),
      comparisonPeriodStart: input.comparisonPeriodStart ? new Date(input.comparisonPeriodStart) : null,
      comparisonPeriodEnd: input.comparisonPeriodEnd ? new Date(input.comparisonPeriodEnd) : null,
      provider: input.provider ?? input.analysis.provider,
      accountId: input.accountId ?? input.analysis.accountId,
      campaignId: input.campaignId ?? input.analysis.campaignId,
      currency: input.analysis.currency ?? "USD",
      reportingCurrency: input.analysis.reportingCurrency,
      attributionModel: input.analysis.attributionModel ?? "last_click",
      comparisonAttributionModel: input.analysis.comparisonAttributionModel,
      minimumVolume: input.analysis.minimumVolume ?? MINIMUM_VOLUME_DEFAULT,
      metrics: input.analysis.metrics ?? {},
      dataQuality: input.analysis.dataQuality ?? { freshnessHours: null, hasTracking: true },
      budgetPacing: input.analysis.budgetPacing,
      activeExperiment: input.analysis.activeExperiment,
      recentMaterialChanges: input.analysis.recentMaterialChanges,
      userNotes: input.analysis.userNotes,
    };

    let analysis;
    try {
      analysis = runOptimisationAnalysis(analysisInput);
    } catch (e) {
      throw new AppError("VALIDATION_ERROR", e instanceof Error ? e.message : "Analysis blocked by guardrails.");
    }

    return prisma.$transaction(async (tx) => {
      const run = await tx.advertisingOptimisationRun.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          reviewType: input.reviewType as Prisma.AdvertisingOptimisationRunCreateInput["reviewType"],
          status: "RUNNING",
          dateRangeStart: analysisInput.dateRangeStart,
          dateRangeEnd: analysisInput.dateRangeEnd,
          comparisonPeriodStart: analysisInput.comparisonPeriodStart,
          comparisonPeriodEnd: analysisInput.comparisonPeriodEnd,
          provider: input.provider,
          accountId: input.accountId,
          campaignId: input.campaignId,
          guardrailWarnings: [...analysis.guardrails.warnings, ...analysis.guardrails.blockReasons] as Prisma.InputJsonValue,
          initiatedByUserId: context.userProfileId,
        },
      });

      await tx.advertisingOptimisationEvidence.create({
        data: {
          runId: run.id,
          dateRangeStart: analysis.evidence.dateRangeStart,
          dateRangeEnd: analysis.evidence.dateRangeEnd,
          comparisonPeriodStart: analysis.evidence.comparisonPeriodStart,
          comparisonPeriodEnd: analysis.evidence.comparisonPeriodEnd,
          provider: analysis.evidence.provider,
          accountId: analysis.evidence.accountId,
          campaignId: analysis.evidence.campaignId,
          metrics: analysis.evidence.metrics as Prisma.InputJsonValue,
          metricDefinitions: analysis.evidence.metricDefinitions as Prisma.InputJsonValue,
          currency: analysis.evidence.currency,
          attributionModel: analysis.evidence.attributionModel,
          freshnessHours: analysis.evidence.freshnessHours,
          qualityWarnings: analysis.evidence.qualityWarnings as Prisma.InputJsonValue,
          minimumVolume: analysis.evidence.minimumVolume,
          minimumVolumeMet: analysis.evidence.minimumVolumeMet,
          activeExperimentStatus: analysis.evidence.activeExperimentStatus as Prisma.InputJsonValue,
          recentMaterialChanges: analysis.evidence.recentMaterialChanges as Prisma.InputJsonValue,
        },
      });

      for (const finding of analysis.findings) {
        const createdFinding = await tx.advertisingOptimisationFinding.create({
          data: {
            runId: run.id,
            findingType: finding.findingType as Prisma.AdvertisingOptimisationFindingCreateInput["findingType"],
            severity: finding.severity,
            title: finding.title,
            description: finding.description,
            provider: input.provider,
            accountId: input.accountId,
            campaignId: input.campaignId,
            suppressed: finding.suppressed,
            suppressionReason: finding.suppressionReason,
          },
        });

        const relatedRecs = analysis.recommendations.filter((r) => r.findingType === finding.findingType);
        for (const rec of relatedRecs) {
          await createRecommendationWithActions(tx, run.id, createdFinding.id, rec, analysis.actionProposals);
        }
      }

      const orphanRecs = analysis.recommendations.filter(
        (r) => !analysis.findings.some((f) => f.findingType === r.findingType && !f.suppressed),
      );
      for (const rec of orphanRecs) {
        await createRecommendationWithActions(tx, run.id, null, rec, analysis.actionProposals);
      }

      return tx.advertisingOptimisationRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          summary: `Completed ${input.reviewType} review with ${analysis.findings.length} findings and ${analysis.recommendations.length} recommendations.`,
        },
        include: runInclude,
      });
    });
  },

  async approveAction(
    actionProposalId: string,
    brandId: string,
    organisationId: string,
    notes: string | undefined,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const proposal = await prisma.advertisingOptimisationActionProposal.findFirst({
      where: { id: actionProposalId, recommendation: { run: { organisationId, brandId } } },
      include: { recommendation: true },
    });
    if (!proposal) throw new AppError("NOT_FOUND", "Action proposal not found.");
    if (proposal.status === "BLOCKED") {
      throw new AppError("VALIDATION_ERROR", proposal.blockedReason ?? "Action is blocked.");
    }

    const spendCheck = blockAutonomousSpendIncrease(
      proposal.recommendation.recommendationType,
      true,
    );
    if (!spendCheck.allowed) {
      throw new AppError("VALIDATION_ERROR", spendCheck.reason);
    }

    if (!canApplyAction(proposal.status, true)) {
      throw new AppError("VALIDATION_ERROR", "Action cannot be applied without approval.");
    }

    return prisma.$transaction(async (tx) => {
      await tx.advertisingOptimisationApproval.create({
        data: {
          actionProposalId,
          approverUserId: context.userProfileId,
          decision: "APPROVED",
          notes,
        },
      });
      return tx.advertisingOptimisationActionProposal.update({
        where: { id: actionProposalId },
        data: { status: "APPROVED" },
        include: { approvals: true, recommendation: true },
      });
    });
  },

  async submitFeedback(
    recommendationId: string,
    brandId: string,
    organisationId: string,
    input: { status: string; userExplanation?: string },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const validation = validateFeedback(input);
    if (!validation.valid) throw new AppError("VALIDATION_ERROR", validation.errors.join(" "));

    const recommendation = await prisma.advertisingOptimisationRecommendation.findFirst({
      where: { id: recommendationId, run: { organisationId, brandId } },
    });
    if (!recommendation) throw new AppError("NOT_FOUND", "Recommendation not found.");

    return prisma.advertisingOptimisationFeedback.create({
      data: {
        recommendationId,
        userId: context.userProfileId,
        status: input.status as Prisma.AdvertisingOptimisationFeedbackCreateInput["status"],
        userExplanation: input.userExplanation,
      },
    });
  },

  async recordOutcome(
    recommendationId: string,
    brandId: string,
    organisationId: string,
    input: {
      actionProposalId?: string;
      preMetrics?: Record<string, number>;
      postMetrics?: Record<string, number>;
      outcomeStatus: string;
      notes?: string;
    },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const outcomeResult = recordOutcome({
      preMetrics: input.preMetrics,
      postMetrics: input.postMetrics,
      outcomeStatus: input.outcomeStatus as "PENDING" | "MEASURED" | "UNAVAILABLE",
      notes: input.notes,
    });

    if (!canClaimSuccess("IMPLEMENTED", outcomeResult.successClaimed)) {
      // still allow recording but never claim success without measured data
    }

    return prisma.advertisingOptimisationOutcome.create({
      data: {
        recommendationId,
        actionProposalId: input.actionProposalId,
        outcomeStatus: outcomeResult.outcomeStatus as Prisma.AdvertisingOptimisationOutcomeCreateInput["outcomeStatus"],
        preMetrics: input.preMetrics as Prisma.InputJsonValue,
        postMetrics: input.postMetrics as Prisma.InputJsonValue,
        measuredAt: outcomeResult.outcomeStatus === "MEASURED" ? new Date() : null,
        successClaimed: outcomeResult.successClaimed,
        notes: outcomeResult.reason,
      },
    });
  },
};

async function createRecommendationWithActions(
  tx: Prisma.TransactionClient,
  runId: string,
  findingId: string | null,
  rec: {
    recommendationType: string;
    title: string;
    description: string;
    confidenceLevel: string;
    evidenceStrength: string;
    sampleSizeState: string;
    dataQualityState: string;
    alternativeExplanations: string[];
    risk: string;
    missingData: string[];
    budgetImpact: string;
    requiresApproval: boolean;
    measurementPlan: string;
  },
  actionProposals: Array<{
    recommendationType: string;
    actionClass: string;
    title: string;
    description: string;
    evaluation: ReturnType<typeof evaluateActionProposal>;
  }>,
) {
  const recommendation = await tx.advertisingOptimisationRecommendation.create({
    data: {
      runId,
      findingId,
      recommendationType: rec.recommendationType as Prisma.AdvertisingOptimisationRecommendationCreateInput["recommendationType"],
      title: rec.title,
      description: rec.description,
      confidenceLevel: rec.confidenceLevel as Prisma.AdvertisingOptimisationRecommendationCreateInput["confidenceLevel"],
      evidenceStrength: rec.evidenceStrength,
      sampleSizeState: rec.sampleSizeState as Prisma.AdvertisingOptimisationRecommendationCreateInput["sampleSizeState"],
      dataQualityState: rec.dataQualityState as Prisma.AdvertisingOptimisationRecommendationCreateInput["dataQualityState"],
      alternativeExplanations: rec.alternativeExplanations as Prisma.InputJsonValue,
      risk: rec.risk,
      missingData: rec.missingData as Prisma.InputJsonValue,
      budgetImpact: rec.budgetImpact,
      requiresApproval: rec.requiresApproval,
      measurementPlan: rec.measurementPlan,
    },
  });

  const action = actionProposals.find((a) => a.recommendationType === rec.recommendationType) ?? {
    actionClass: mapRecommendationToActionClass(rec.recommendationType),
    title: rec.title,
    description: rec.description,
    evaluation: evaluateActionProposal({
      actionClass: mapRecommendationToActionClass(rec.recommendationType),
      title: rec.title,
      description: rec.description,
      fromLlmOutput: true,
    }),
  };

  await tx.advertisingOptimisationActionProposal.create({
    data: {
      recommendationId: recommendation.id,
      actionClass: action.actionClass as Prisma.AdvertisingOptimisationActionProposalCreateInput["actionClass"],
      title: action.title,
      description: action.description,
      requiresApproval: action.evaluation.requiresApproval,
      status: action.evaluation.status as Prisma.AdvertisingOptimisationActionProposalCreateInput["status"],
      blockedReason: action.evaluation.blockedReason,
    },
  });

  return recommendation;
}
