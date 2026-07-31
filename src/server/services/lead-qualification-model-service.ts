import { createHash } from "crypto";
import type { LeadScoringQualificationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { mapLibQualificationToDb } from "@/lib/lead-scoring/mappers";
import { detectMissingInfo, mapScoreToQualificationStatus } from "@/lib/lead-scoring/qualification";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import {
  leadScoringService,
  loadLeadSnapshot,
} from "@/server/services/lead-scoring-service";
import { brandService } from "@/server/services/workspace-service";

const qualificationModelInclude = {
  scoringModel: true,
  versions: { orderBy: { versionNumber: "desc" as const }, take: 1 },
  activeVersion: true,
} satisfies Prisma.LeadQualificationModelInclude;

const resultInclude = {
  qualificationModel: true,
  version: true,
  scoringSnapshot: { include: { contributions: true } },
  overrides: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.LeadQualificationResultInclude;

function hashThresholds(thresholds: Prisma.InputJsonValue, stateMappings?: Prisma.InputJsonValue): string {
  return createHash("sha256")
    .update(JSON.stringify({ thresholds, stateMappings: stateMappings ?? null }))
    .digest("hex");
}

async function getQualificationModelOrThrow(
  qualificationModelId: string,
  brandId: string,
  organisationId: string,
  context: TenantContext,
) {
  await brandService.getById(brandId, organisationId, context);
  const model = await prisma.leadQualificationModel.findFirst({
    where: { id: qualificationModelId, organisationId, brandId },
    include: qualificationModelInclude,
  });
  if (!model) throw new AppError("NOT_FOUND", "Qualification model not found.");
  return model;
}

export const leadQualificationModelService = {
  async listQualificationModels(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.leadQualificationModel.findMany({
      where: { organisationId, brandId, status: { not: "ARCHIVED" } },
      include: qualificationModelInclude,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  },

  async getQualificationModel(
    qualificationModelId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    return getQualificationModelOrThrow(qualificationModelId, brandId, organisationId, context);
  },

  async createQualificationModel(
    brandId: string,
    organisationId: string,
    input: {
      name: string;
      description?: string;
      scoringModelId?: string;
      thresholds?: Prisma.InputJsonValue;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    if (input.scoringModelId) {
      const scoringModel = await prisma.leadScoringModel.findFirst({
        where: { id: input.scoringModelId, organisationId, brandId },
      });
      if (!scoringModel) throw new AppError("NOT_FOUND", "Scoring model not found.");
    }

    return prisma.$transaction(async (tx) => {
      const model = await tx.leadQualificationModel.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          name: input.name,
          description: input.description,
          scoringModelId: input.scoringModelId,
          thresholds: input.thresholds,
        },
      });
      const version = await tx.leadQualificationModelVersion.create({
        data: {
          qualificationModelId: model.id,
          versionNumber: 1,
          thresholdsHash: input.thresholds ? hashThresholds(input.thresholds) : undefined,
          stateMappings: input.thresholds,
        },
      });
      return tx.leadQualificationModel.update({
        where: { id: model.id },
        data: { activeVersionId: version.id },
        include: qualificationModelInclude,
      });
    });
  },

  async updateQualificationModel(
    qualificationModelId: string,
    brandId: string,
    organisationId: string,
    input: {
      name?: string;
      description?: string;
      scoringModelId?: string | null;
      thresholds?: Prisma.InputJsonValue;
      stateMappings?: Prisma.InputJsonValue;
    },
    context: TenantContext,
  ) {
    const model = await getQualificationModelOrThrow(
      qualificationModelId,
      brandId,
      organisationId,
      context,
    );

    if (input.scoringModelId) {
      const scoringModel = await prisma.leadScoringModel.findFirst({
        where: { id: input.scoringModelId, organisationId, brandId },
      });
      if (!scoringModel) throw new AppError("NOT_FOUND", "Scoring model not found.");
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.leadQualificationModel.update({
        where: { id: qualificationModelId },
        data: {
          name: input.name,
          description: input.description,
          scoringModelId: input.scoringModelId,
          thresholds: input.thresholds,
        },
        include: qualificationModelInclude,
      });

      if (input.thresholds !== undefined || input.stateMappings !== undefined) {
        const versionId = model.activeVersionId ?? model.versions[0]?.id;
        if (versionId) {
          await tx.leadQualificationModelVersion.update({
            where: { id: versionId },
            data: {
              thresholdsHash: hashThresholds(
                input.thresholds ?? (model.thresholds as Prisma.InputJsonValue) ?? {},
                input.stateMappings,
              ),
              stateMappings: input.stateMappings ?? input.thresholds,
            },
          });
        }
      }

      return updated;
    });
  },

  async deleteQualificationModel(
    qualificationModelId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    await getQualificationModelOrThrow(qualificationModelId, brandId, organisationId, context);
    return prisma.leadQualificationModel.update({
      where: { id: qualificationModelId },
      data: { status: "ARCHIVED" },
      include: qualificationModelInclude,
    });
  },

  async computeQualification(
    qualificationModelId: string,
    brandId: string,
    organisationId: string,
    input: { leadId: string; scoringSnapshotId?: string },
    context: TenantContext,
  ) {
    const model = await getQualificationModelOrThrow(
      qualificationModelId,
      brandId,
      organisationId,
      context,
    );
    const versionId = model.activeVersionId ?? model.versions[0]?.id;
    if (!versionId) throw new AppError("VALIDATION_ERROR", "Qualification model has no version.");

    const leadSnapshot = await loadLeadSnapshot(input.leadId, organisationId, brandId);
    let scoringSnapshotId = input.scoringSnapshotId;
    let computedScore = 0;
    let qualificationResult = mapScoreToQualificationStatus(
      {
        scoreVersion: "1.0.0",
        leadId: input.leadId,
        fitScore: 0,
        engagementScore: 0,
        negativeScore: 0,
        compositeScore: 0,
        breakdown: {
          fit: { category: "FIT", rawPoints: 0, cappedPoints: 0, decayedPoints: 0, capApplied: false, evidence: [] },
          engagement: { category: "ENGAGEMENT", rawPoints: 0, cappedPoints: 0, decayedPoints: 0, capApplied: false, evidence: [] },
          negative: { category: "NEGATIVE", rawPoints: 0, cappedPoints: 0, decayedPoints: 0, capApplied: false, evidence: [] },
        },
        evidence: [],
        capsApplied: [],
        computedAt: new Date().toISOString(),
      },
      leadSnapshot,
    );

    if (scoringSnapshotId) {
      const scoreSnapshot = await prisma.leadScoreSnapshot.findFirst({
        where: { id: scoringSnapshotId, leadId: input.leadId },
      });
      if (scoreSnapshot) {
        computedScore = scoreSnapshot.combinedScore ?? 0;
        qualificationResult = mapScoreToQualificationStatus(
          {
            scoreVersion: "1.0.0",
            leadId: input.leadId,
            fitScore: scoreSnapshot.fitScore ?? 0,
            engagementScore: scoreSnapshot.engagementScore ?? 0,
            negativeScore: scoreSnapshot.riskScore ?? 0,
            compositeScore: computedScore,
            breakdown: {
              fit: { category: "FIT", rawPoints: 0, cappedPoints: 0, decayedPoints: 0, capApplied: false, evidence: [] },
              engagement: { category: "ENGAGEMENT", rawPoints: 0, cappedPoints: 0, decayedPoints: 0, capApplied: false, evidence: [] },
              negative: { category: "NEGATIVE", rawPoints: 0, cappedPoints: 0, decayedPoints: 0, capApplied: false, evidence: [] },
            },
            evidence: [],
            capsApplied: [],
            computedAt: new Date().toISOString(),
          },
          leadSnapshot,
        );
      }
    } else if (model.scoringModelId) {
      const scoreSnapshot = await leadScoringService.scoreLead(
        model.scoringModelId,
        brandId,
        organisationId,
        { leadId: input.leadId },
        context,
      );
      scoringSnapshotId = scoreSnapshot.id;
      computedScore = scoreSnapshot.combinedScore ?? 0;
      qualificationResult = mapScoreToQualificationStatus(
        {
          scoreVersion: "1.0.0",
          leadId: input.leadId,
          fitScore: scoreSnapshot.fitScore ?? 0,
          engagementScore: scoreSnapshot.engagementScore ?? 0,
          negativeScore: scoreSnapshot.riskScore ?? 0,
          compositeScore: computedScore,
          breakdown: {
            fit: { category: "FIT", rawPoints: 0, cappedPoints: 0, decayedPoints: 0, capApplied: false, evidence: [] },
            engagement: { category: "ENGAGEMENT", rawPoints: 0, cappedPoints: 0, decayedPoints: 0, capApplied: false, evidence: [] },
            negative: { category: "NEGATIVE", rawPoints: 0, cappedPoints: 0, decayedPoints: 0, capApplied: false, evidence: [] },
          },
          evidence: [],
          capsApplied: [],
          computedAt: new Date().toISOString(),
        },
        leadSnapshot,
      );
    }

    const missingInfo = detectMissingInfo(leadSnapshot);
    const dbStatus = mapLibQualificationToDb(qualificationResult.status);
    const existing = await prisma.leadQualificationResult.findFirst({
      where: { leadId: input.leadId, qualificationModelId },
      orderBy: { updatedAt: "desc" },
    });

    const data = {
      versionId,
      scoringSnapshotId,
      status: dbStatus,
      score: computedScore,
      missingInfo,
      evidence: {
        reasons: qualificationResult.reasons,
        confidence: qualificationResult.confidence,
      },
    };

    if (existing) {
      return prisma.leadQualificationResult.update({
        where: { id: existing.id },
        data,
        include: resultInclude,
      });
    }

    return prisma.leadQualificationResult.create({
      data: {
        leadId: input.leadId,
        qualificationModelId,
        ...data,
      },
      include: resultInclude,
    });
  },

  async applyOverride(
    qualificationModelId: string,
    brandId: string,
    organisationId: string,
    input: {
      leadId: string;
      newStatus: LeadScoringQualificationStatus;
      reason?: string;
    },
    context: TenantContext,
  ) {
    await getQualificationModelOrThrow(qualificationModelId, brandId, organisationId, context);

    const result = await prisma.leadQualificationResult.findFirst({
      where: { leadId: input.leadId, qualificationModelId },
      orderBy: { updatedAt: "desc" },
    });
    if (!result) throw new AppError("NOT_FOUND", "Qualification result not found.");

    return prisma.$transaction(async (tx) => {
      await tx.leadQualificationOverride.create({
        data: {
          resultId: result.id,
          previousStatus: result.status,
          newStatus: input.newStatus,
          reason: input.reason,
          overriddenByUserId: context.userProfileId,
        },
      });

      const updated = await tx.leadQualificationResult.update({
        where: { id: result.id },
        data: {
          status: input.newStatus,
          hasOverride: true,
        },
        include: resultInclude,
      });

      await recordAuditEvent({
        organisationId,
        actorUserId: context.userProfileId,
        action: "leadScoring.override",
        resourceType: "LeadQualificationResult",
        resourceId: result.id,
        metadata: {
          brandId,
          qualificationModelId,
          leadId: input.leadId,
          newStatus: input.newStatus,
        },
      });

      return updated;
    });
  },

  async getQualificationResult(
    qualificationModelId: string,
    brandId: string,
    organisationId: string,
    leadId: string,
    context: TenantContext,
  ) {
    await getQualificationModelOrThrow(qualificationModelId, brandId, organisationId, context);
    const result = await prisma.leadQualificationResult.findFirst({
      where: { qualificationModelId, leadId },
      include: resultInclude,
      orderBy: { updatedAt: "desc" },
    });
    if (!result) throw new AppError("NOT_FOUND", "Qualification result not found.");
    return result;
  },
};
