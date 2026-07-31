import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { buildScoringModelFromGroups } from "@/lib/lead-scoring/mappers";
import { mapScoreToQualificationStatus } from "@/lib/lead-scoring/qualification";
import { simulateModel } from "@/lib/lead-scoring/simulation";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { loadLeadSnapshot } from "@/server/services/lead-scoring-service";
import { brandService } from "@/server/services/workspace-service";

const simulationInclude = {
  model: true,
  version: {
    include: {
      ruleGroups: {
        include: { rules: true },
        orderBy: { sortOrder: "asc" as const },
      },
    },
  },
  approvedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.LeadScoringSimulationInclude;

async function getSimulationOrThrow(
  simulationId: string,
  modelId: string,
  brandId: string,
  organisationId: string,
  context: TenantContext,
) {
  await brandService.getById(brandId, organisationId, context);
  const model = await prisma.leadScoringModel.findFirst({
    where: { id: modelId, organisationId, brandId },
  });
  if (!model) throw new AppError("NOT_FOUND", "Scoring model not found.");

  const simulation = await prisma.leadScoringSimulation.findFirst({
    where: { id: simulationId, modelId },
    include: simulationInclude,
  });
  if (!simulation) throw new AppError("NOT_FOUND", "Simulation not found.");
  return simulation;
}

export const leadScoringSimulationService = {
  async runSimulation(
    modelId: string,
    brandId: string,
    organisationId: string,
    input: {
      versionId?: string;
      leadIds?: string[];
      parameters?: Prisma.InputJsonValue;
    },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const model = await prisma.leadScoringModel.findFirst({
      where: { id: modelId, organisationId, brandId },
      include: {
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        activeVersion: {
          include: {
            ruleGroups: {
              include: { rules: true },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });
    if (!model) throw new AppError("NOT_FOUND", "Scoring model not found.");

    const versionId = input.versionId ?? model.activeVersionId ?? model.versions[0]?.id;
    if (!versionId) throw new AppError("VALIDATION_ERROR", "No version available for simulation.");

    const version = await prisma.leadScoringModelVersion.findFirst({
      where: { id: versionId, modelId },
      include: {
        ruleGroups: {
          include: { rules: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!version) throw new AppError("NOT_FOUND", "Version not found.");

    const simulation = await prisma.leadScoringSimulation.create({
      data: {
        modelId,
        versionId,
        status: "RUNNING",
        parameters: input.parameters,
      },
    });

    try {
      const leads = await prisma.crmLead.findMany({
        where: {
          organisationId,
          brandId,
          archivedAt: null,
          ...(input.leadIds?.length ? { id: { in: input.leadIds } } : {}),
        },
        take: input.leadIds?.length ? undefined : 500,
        select: { id: true },
      });

      const scoringModel = buildScoringModelFromGroups(
        model.id,
        model.name,
        version.versionNumber,
        version.ruleGroups,
      );

      const simulationInputs = await Promise.all(
        leads.map(async (lead) => {
          const snapshot = await loadLeadSnapshot(lead.id, organisationId, brandId);
          const latestSnapshot = await prisma.leadScoreSnapshot.findFirst({
            where: { leadId: lead.id, modelId },
            orderBy: { calculatedAt: "desc" },
          });
          const latestResult = latestSnapshot
            ? mapScoreToQualificationStatus(
                {
                  scoreVersion: "1.0.0",
                  leadId: lead.id,
                  fitScore: latestSnapshot.fitScore ?? 0,
                  engagementScore: latestSnapshot.engagementScore ?? 0,
                  negativeScore: latestSnapshot.riskScore ?? 0,
                  compositeScore: latestSnapshot.combinedScore ?? 0,
                  breakdown: {
                    fit: { category: "FIT", rawPoints: 0, cappedPoints: 0, decayedPoints: 0, capApplied: false, evidence: [] },
                    engagement: { category: "ENGAGEMENT", rawPoints: 0, cappedPoints: 0, decayedPoints: 0, capApplied: false, evidence: [] },
                    negative: { category: "NEGATIVE", rawPoints: 0, cappedPoints: 0, decayedPoints: 0, capApplied: false, evidence: [] },
                  },
                  evidence: [],
                  capsApplied: [],
                  computedAt: new Date().toISOString(),
                },
                snapshot,
              )
            : null;

          return {
            snapshot,
            previousStatus: latestResult?.status,
            previousCompositeScore: latestSnapshot?.combinedScore ?? undefined,
          };
        }),
      );

      const results = simulateModel(scoringModel, simulationInputs);

      return prisma.leadScoringSimulation.update({
        where: { id: simulation.id },
        data: {
          status: "COMPLETED",
          results: results as unknown as Prisma.InputJsonValue,
        },
        include: simulationInclude,
      });
    } catch (error) {
      await prisma.leadScoringSimulation.update({
        where: { id: simulation.id },
        data: {
          status: "REJECTED",
          results: {
            error: error instanceof Error ? error.message : "Simulation failed.",
          },
        },
      });
      throw error;
    }
  },

  async getSimulation(
    simulationId: string,
    modelId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    return getSimulationOrThrow(simulationId, modelId, brandId, organisationId, context);
  },

  async approveSimulation(
    simulationId: string,
    modelId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    const simulation = await getSimulationOrThrow(
      simulationId,
      modelId,
      brandId,
      organisationId,
      context,
    );
    if (simulation.status !== "COMPLETED") {
      throw new AppError("VALIDATION_ERROR", "Only completed simulations can be approved.");
    }

    const updated = await prisma.leadScoringSimulation.update({
      where: { id: simulationId },
      data: {
        status: "APPROVED",
        approvedByUserId: context.userProfileId,
      },
      include: simulationInclude,
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "leadScoring.approveSimulation",
      resourceType: "LeadScoringSimulation",
      resourceId: simulationId,
      metadata: { brandId, modelId },
    });

    return updated;
  },
};
