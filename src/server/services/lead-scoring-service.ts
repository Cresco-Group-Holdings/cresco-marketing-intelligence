import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { normaliseEmailAddress } from "@/lib/email/suppression";
import { AppError } from "@/lib/errors";
import { generateScoreExplanation } from "@/lib/lead-scoring/ai-assistant";
import {
  buildScoringModelFromGroups,
  buildScoringModelFromInput,
  categoryToScoreType,
  hashRuleGroups,
  mapLibQualificationToDb,
  type SaveRuleGroupInput,
} from "@/lib/lead-scoring/mappers";
import { mapScoreToQualificationStatus } from "@/lib/lead-scoring/qualification";
import { computeScores } from "@/lib/lead-scoring/scoring";
import { validateModelSafety } from "@/lib/lead-scoring/safety";
import type { LeadSnapshot } from "@/lib/lead-scoring/signals";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";

const versionInclude = {
  ruleGroups: {
    include: { rules: true },
    orderBy: { sortOrder: "asc" as const },
  },
} satisfies Prisma.LeadScoringModelVersionInclude;

const modelInclude = {
  versions: { orderBy: { versionNumber: "desc" as const }, take: 1, include: versionInclude },
  activeVersion: { include: versionInclude },
} satisfies Prisma.LeadScoringModelInclude;

const snapshotInclude = {
  contributions: { include: { rule: true } },
  version: { include: versionInclude },
} satisfies Prisma.LeadScoreSnapshotInclude;

export type { SaveRuleGroupInput, SaveRuleInput } from "@/lib/lead-scoring/mappers";

export async function loadLeadSnapshot(
  leadId: string,
  organisationId: string,
  brandId: string,
): Promise<LeadSnapshot> {
  const lead = await prisma.crmLead.findFirst({
    where: { id: leadId, organisationId, brandId, archivedAt: null },
    include: {
      tagLinks: { include: { tag: true } },
      person: { include: { contactMethods: true } },
      source: true,
      company: true,
    },
  });
  if (!lead) throw new AppError("NOT_FOUND", "Lead not found.");

  let consentMarketing = false;
  let suppressed = false;
  if (lead.marketingLeadId) {
    const consent = await prisma.leadConsent.findFirst({
      where: { marketingLeadId: lead.marketingLeadId, organisationId, brandId },
      orderBy: { recordedAt: "desc" },
    });
    consentMarketing = consent?.marketingOptIn ?? false;
    suppressed = consent?.suppressed ?? false;
  }

  const email = lead.person?.contactMethods.find((m) => m.methodType === "EMAIL")?.normalisedValue;
  if (email) {
    const emailSuppression = await prisma.emailSuppression.findFirst({
      where: { organisationId, emailAddress: normaliseEmailAddress(email) },
    });
    if (emailSuppression) suppressed = true;
  }

  return {
    leadId: lead.id,
    status: lead.status,
    lifecycleStage: lead.lifecycleStage,
    qualificationState: lead.qualificationState,
    productInterest: lead.primaryProductInterest ?? undefined,
    country: lead.country ?? undefined,
    language: lead.preferredLanguage ?? undefined,
    consentMarketing,
    suppressed,
    unsubscribed: !consentMarketing && !!lead.marketingLeadId,
    sourceType: lead.source?.sourceType,
    ownerUserId: lead.ownerUserId ?? undefined,
    lastActivityAt: lead.lastActivityAt ?? undefined,
    tags: lead.tagLinks.map((link) => link.tag.name),
    industry: lead.company?.industry ?? undefined,
    companySize: lead.company?.employeeSizeBand ?? undefined,
  };
}

async function getLatestVersionId(modelId: string) {
  const version = await prisma.leadScoringModelVersion.findFirst({
    where: { modelId },
    orderBy: { versionNumber: "desc" },
  });
  return version?.id;
}

async function getModelOrThrow(
  modelId: string,
  brandId: string,
  organisationId: string,
  context: TenantContext,
) {
  await brandService.getById(brandId, organisationId, context);
  const model = await prisma.leadScoringModel.findFirst({
    where: { id: modelId, organisationId, brandId },
    include: modelInclude,
  });
  if (!model) throw new AppError("NOT_FOUND", "Scoring model not found.");
  return model;
}

export const leadScoringService = {
  async listModels(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.leadScoringModel.findMany({
      where: { organisationId, brandId, status: { not: "ARCHIVED" } },
      include: modelInclude,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  },

  async getModel(
    modelId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    return getModelOrThrow(modelId, brandId, organisationId, context);
  },

  async createModel(
    brandId: string,
    organisationId: string,
    input: { name: string; description?: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    return prisma.$transaction(async (tx) => {
      const model = await tx.leadScoringModel.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          name: input.name,
          description: input.description,
          createdByUserId: context.userProfileId,
        },
      });
      const version = await tx.leadScoringModelVersion.create({
        data: { modelId: model.id, versionNumber: 1 },
      });
      return tx.leadScoringModel.update({
        where: { id: model.id },
        data: { activeVersionId: version.id },
        include: modelInclude,
      });
    });
  },

  async updateModel(
    modelId: string,
    brandId: string,
    organisationId: string,
    input: { name?: string; description?: string },
    context: TenantContext,
  ) {
    await getModelOrThrow(modelId, brandId, organisationId, context);
    return prisma.leadScoringModel.update({
      where: { id: modelId },
      data: {
        ...input,
        updatedByUserId: context.userProfileId,
      },
      include: modelInclude,
    });
  },

  async saveRules(
    modelId: string,
    brandId: string,
    organisationId: string,
    input: { groups: SaveRuleGroupInput[] },
    context: TenantContext,
  ) {
    const model = await getModelOrThrow(modelId, brandId, organisationId, context);
    if (model.status === "ACTIVE") {
      throw new AppError("VALIDATION_ERROR", "Cannot edit rules while model is active.");
    }

    const scoringModel = buildScoringModelFromInput(modelId, model.name, input.groups);
    const safety = validateModelSafety(scoringModel);
    if (!safety.safe) {
      throw new AppError("VALIDATION_ERROR", safety.issues.join(" "));
    }

    const rulesHash = hashRuleGroups(input.groups);
    const versionId = model.versions[0]?.id ?? (await getLatestVersionId(modelId));
    if (!versionId) throw new AppError("VALIDATION_ERROR", "Model has no version.");

    return prisma.$transaction(async (tx) => {
      await tx.leadScoringRule.deleteMany({
        where: { group: { versionId } },
      });
      await tx.leadScoringRuleGroup.deleteMany({ where: { versionId } });

      for (const [groupIndex, group] of input.groups.entries()) {
        const createdGroup = await tx.leadScoringRuleGroup.create({
          data: {
            versionId,
            name: group.name,
            scoreType: group.scoreType,
            maxGroupContribution: group.maxGroupContribution,
            sortOrder: group.sortOrder ?? groupIndex,
          },
        });

        for (const rule of group.rules) {
          await tx.leadScoringRule.create({
            data: {
              groupId: createdGroup.id,
              signal: rule.signal,
              signalCategory: rule.signalCategory,
              operator: rule.operator.toUpperCase() as import("@prisma/client").LeadScoringRuleOperator,
              value: rule.value,
              scoreEffect: rule.scoreEffect,
              maxContribution: rule.maxContribution,
              decayType: rule.decayType ?? "NONE",
              decayHalfLifeDays: rule.decayHalfLifeDays,
              windowDays: rule.windowDays,
              evidence: rule.evidence,
              isActive: rule.isActive ?? true,
              allowDecay: rule.allowDecay ?? true,
            },
          });
        }
      }

      const version = await tx.leadScoringModelVersion.update({
        where: { id: versionId },
        data: { rulesHash, status: "DRAFT" },
        include: versionInclude,
      });

      await tx.leadScoringModel.update({
        where: { id: modelId },
        data: { status: "DRAFT", updatedByUserId: context.userProfileId },
      });

      return version;
    });
  },

  async submitForReview(
    modelId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    const model = await getModelOrThrow(modelId, brandId, organisationId, context);
    const version = model.versions[0];
    if (!version) throw new AppError("VALIDATION_ERROR", "No version to submit.");
    if (!version.ruleGroups.length) {
      throw new AppError("VALIDATION_ERROR", "Scoring model has no rule groups.");
    }

    const scoringModel = buildScoringModelFromGroups(
      model.id,
      model.name,
      version.versionNumber,
      version.ruleGroups,
    );
    const safety = validateModelSafety(scoringModel);
    if (!safety.safe) {
      throw new AppError("VALIDATION_ERROR", safety.issues.join(" "));
    }

    await prisma.$transaction([
      prisma.leadScoringModel.update({
        where: { id: modelId },
        data: { status: "IN_REVIEW", updatedByUserId: context.userProfileId },
      }),
      prisma.leadScoringModelVersion.update({
        where: { id: version.id },
        data: { status: "IN_REVIEW" },
      }),
    ]);

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "leadScoring.submitForReview",
      resourceType: "LeadScoringModel",
      resourceId: modelId,
      metadata: { brandId, versionId: version.id },
    });

    return getModelOrThrow(modelId, brandId, organisationId, context);
  },

  async approveVersion(
    modelId: string,
    brandId: string,
    organisationId: string,
    input: { versionId?: string; notes?: string },
    context: TenantContext,
  ) {
    const model = await getModelOrThrow(modelId, brandId, organisationId, context);
    const versionId = input.versionId ?? model.versions[0]?.id;
    if (!versionId) throw new AppError("VALIDATION_ERROR", "No version to approve.");

    const version = await prisma.leadScoringModelVersion.findFirst({
      where: { id: versionId, modelId },
      include: versionInclude,
    });
    if (!version) throw new AppError("NOT_FOUND", "Version not found.");
    if (version.status !== "IN_REVIEW") {
      throw new AppError("VALIDATION_ERROR", "Version must be in review to approve.");
    }

    await prisma.$transaction([
      prisma.leadScoringModelVersion.update({
        where: { id: versionId },
        data: { status: "APPROVED", notes: input.notes },
      }),
      prisma.leadScoringModel.update({
        where: { id: modelId },
        data: { status: "APPROVED", updatedByUserId: context.userProfileId },
      }),
    ]);

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "leadScoring.approve",
      resourceType: "LeadScoringModel",
      resourceId: modelId,
      metadata: { brandId, versionId },
    });

    return getModelOrThrow(modelId, brandId, organisationId, context);
  },

  async activateVersion(
    modelId: string,
    brandId: string,
    organisationId: string,
    input: { versionId?: string },
    context: TenantContext,
  ) {
    const model = await getModelOrThrow(modelId, brandId, organisationId, context);
    const versionId = input.versionId ?? model.versions[0]?.id;
    if (!versionId) throw new AppError("VALIDATION_ERROR", "No version to activate.");

    const version = await prisma.leadScoringModelVersion.findFirst({
      where: { id: versionId, modelId },
    });
    if (!version) throw new AppError("NOT_FOUND", "Version not found.");
    if (version.status !== "APPROVED" && version.status !== "ACTIVE") {
      throw new AppError("VALIDATION_ERROR", "Version must be approved before activation.");
    }

    await prisma.$transaction([
      prisma.leadScoringModel.updateMany({
        where: { brandId, organisationId, status: "ACTIVE", id: { not: modelId } },
        data: { status: "ARCHIVED" },
      }),
      prisma.leadScoringModel.update({
        where: { id: modelId },
        data: {
          status: "ACTIVE",
          activeVersionId: versionId,
          updatedByUserId: context.userProfileId,
        },
      }),
      prisma.leadScoringModelVersion.update({
        where: { id: versionId },
        data: { status: "ACTIVE" },
      }),
    ]);

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "leadScoring.activate",
      resourceType: "LeadScoringModel",
      resourceId: modelId,
      metadata: { brandId, versionId },
    });

    return getModelOrThrow(modelId, brandId, organisationId, context);
  },

  async scoreLead(
    modelId: string,
    brandId: string,
    organisationId: string,
    input: { leadId: string; versionId?: string },
    _context: TenantContext,
  ) {
    const model = await getModelOrThrow(modelId, brandId, organisationId, _context);
    const versionId = input.versionId ?? model.activeVersionId ?? model.versions[0]?.id;
    if (!versionId) throw new AppError("VALIDATION_ERROR", "No scoring version available.");

    const version = await prisma.leadScoringModelVersion.findFirst({
      where: { id: versionId, modelId },
      include: versionInclude,
    });
    if (!version) throw new AppError("NOT_FOUND", "Version not found.");

    const snapshot = await loadLeadSnapshot(input.leadId, organisationId, brandId);
    const scoringModel = buildScoringModelFromGroups(
      model.id,
      model.name,
      version.versionNumber,
      version.ruleGroups,
    );
    const computed = computeScores(scoringModel, snapshot);
    const qualification = mapScoreToQualificationStatus(computed, snapshot);

    return prisma.$transaction(async (tx) => {
      const scoreSnapshot = await tx.leadScoreSnapshot.create({
        data: {
          leadId: input.leadId,
          modelId,
          versionId,
          fitScore: computed.fitScore,
          engagementScore: computed.engagementScore,
          riskScore: computed.negativeScore,
          combinedScore: computed.compositeScore,
          qualificationStatus: mapLibQualificationToDb(qualification.status),
        },
      });

      for (const evidence of computed.evidence.filter((item) => item.matched)) {
        const rule = version.ruleGroups
          .flatMap((group) => group.rules)
          .find((item) => item.id === evidence.ruleId);
        if (!rule) continue;

        await tx.leadScoreContribution.create({
          data: {
            snapshotId: scoreSnapshot.id,
            ruleId: rule.id,
            scoreType: categoryToScoreType(rule.signalCategory),
            rawContribution: evidence.points,
            cappedContribution: evidence.cappedPoints,
            evidence: {
              signal: evidence.signal,
              actualValue: evidence.actualValue,
              expectedValue: evidence.expectedValue,
              operator: evidence.operator,
              label: evidence.label,
            },
            decayApplied: false,
          },
        });
      }

      return tx.leadScoreSnapshot.findUniqueOrThrow({
        where: { id: scoreSnapshot.id },
        include: snapshotInclude,
      });
    });
  },

  async getLeadScoreExplanation(
    modelId: string,
    brandId: string,
    organisationId: string,
    input: { leadId: string; versionId?: string },
    context: TenantContext,
  ) {
    const model = await getModelOrThrow(modelId, brandId, organisationId, context);
    const versionId = input.versionId ?? model.activeVersionId ?? model.versions[0]?.id;
    if (!versionId) throw new AppError("VALIDATION_ERROR", "No scoring version available.");

    const version = await prisma.leadScoringModelVersion.findFirst({
      where: { id: versionId, modelId },
      include: versionInclude,
    });
    if (!version) throw new AppError("NOT_FOUND", "Version not found.");

    const snapshot = await loadLeadSnapshot(input.leadId, organisationId, brandId);
    const scoringModel = buildScoringModelFromGroups(
      model.id,
      model.name,
      version.versionNumber,
      version.ruleGroups,
    );
    const computed = computeScores(scoringModel, snapshot);
    const qualification = mapScoreToQualificationStatus(computed, snapshot);

    return generateScoreExplanation(computed, qualification, snapshot);
  },

  async listSnapshots(
    modelId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
    filters?: { leadId?: string; limit?: number },
  ) {
    await getModelOrThrow(modelId, brandId, organisationId, context);
    return prisma.leadScoreSnapshot.findMany({
      where: {
        modelId,
        ...(filters?.leadId ? { leadId: filters.leadId } : {}),
      },
      include: snapshotInclude,
      orderBy: { calculatedAt: "desc" },
      take: filters?.limit ?? 50,
    });
  },
};
