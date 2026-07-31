import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { DEFAULT_PIPELINE_TEMPLATES, STAGE_CATEGORIES } from "@/lib/crm-pipelines/constants";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

const DEFAULT_STAGE_PROBABILITIES: Record<string, number> = {
  OPEN: 5, QUALIFICATION: 10, DISCOVERY: 20, EVALUATION: 35, PROPOSAL: 50,
  NEGOTIATION: 70, TRIAL: 60, WON: 100, LOST: 0,
};

function inferCategory(stageName: string, index: number, total: number): string {
  const lower = stageName.toLowerCase();
  if (lower.includes("won")) return "WON";
  if (lower.includes("lost")) return "LOST";
  if (lower.includes("trial")) return "TRIAL";
  if (lower.includes("negotiat")) return "NEGOTIATION";
  if (lower.includes("proposal")) return "PROPOSAL";
  if (lower.includes("evaluat")) return "EVALUATION";
  if (lower.includes("discover")) return "DISCOVERY";
  if (lower.includes("qualif")) return "QUALIFICATION";
  if (index === 0) return "OPEN";
  if (index === total - 2) return "WON";
  if (index === total - 1) return "LOST";
  return STAGE_CATEGORIES[Math.min(index + 1, STAGE_CATEGORIES.length - 3)] ?? "OPEN";
}

export const crmPipelineService = {
  async listPipelines(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.crmPipeline.findMany({
      where: { organisationId, brandId, archivedAt: null },
      include: {
        versions: { where: { isActive: true }, include: { stages: { where: { isArchived: false }, orderBy: { sortOrder: "asc" } } } },
        _count: { select: { opportunities: true } },
      },
      orderBy: { name: "asc" },
    });
  },

  async getPipeline(pipelineId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const pipeline = await prisma.crmPipeline.findFirst({
      where: { id: pipelineId, organisationId, brandId },
      include: {
        versions: { orderBy: { versionNumber: "desc" }, include: { stages: { orderBy: { sortOrder: "asc" } } } },
        _count: { select: { opportunities: true } },
      },
    });
    if (!pipeline) throw new AppError("NOT_FOUND", "Pipeline not found.");
    return pipeline;
  },

  async createPipeline(
    brandId: string,
    organisationId: string,
    input: { name: string; slug: string; pipelineType?: string; description?: string; template?: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const template = DEFAULT_PIPELINE_TEMPLATES.find((t) => t.pipelineType === (input.template ?? input.pipelineType));

    return prisma.$transaction(async (tx) => {
      const pipeline = await tx.crmPipeline.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          name: input.name,
          slug: input.slug,
          pipelineType: (input.pipelineType ?? "CUSTOM") as Prisma.CrmPipelineCreateInput["pipelineType"],
          description: input.description,
          createdByUserId: context.userProfileId,
        },
      });

      const version = await tx.crmPipelineVersion.create({
        data: { pipelineId: pipeline.id, versionNumber: 1, label: "Initial version", isActive: true, publishedAt: new Date() },
      });

      const stageNames = template?.stages ?? ["Open", "Qualification", "Proposal", "Won", "Lost"];
      for (let i = 0; i < stageNames.length; i++) {
        const category = inferCategory(stageNames[i], i, stageNames.length);
        await tx.crmPipelineStage.create({
          data: {
            versionId: version.id,
            name: stageNames[i],
            sortOrder: i,
            category: category as Prisma.CrmPipelineStageCreateInput["category"],
            probability: DEFAULT_STAGE_PROBABILITIES[category] ?? 10,
            maxDurationDays: category === "NEGOTIATION" ? 30 : category === "TRIAL" ? 14 : null,
            requiresApproval: category === "PROPOSAL",
          },
        });
      }

      await tx.crmPipeline.update({ where: { id: pipeline.id }, data: { currentVersionId: version.id } });
      return tx.crmPipeline.findFirst({
        where: { id: pipeline.id },
        include: {
          versions: { orderBy: { versionNumber: "desc" }, include: { stages: { orderBy: { sortOrder: "asc" } } } },
          _count: { select: { opportunities: true } },
        },
      });
    });
  },

  async createVersion(pipelineId: string, brandId: string, organisationId: string, context: TenantContext) {
    const pipeline = await this.getPipeline(pipelineId, brandId, organisationId, context);
    const latest = pipeline.versions[0];
    const nextNumber = (latest?.versionNumber ?? 0) + 1;

    return prisma.$transaction(async (tx) => {
      if (latest) {
        await tx.crmPipelineVersion.updateMany({ where: { pipelineId, isActive: true }, data: { isActive: false } });
      }
      const version = await tx.crmPipelineVersion.create({
        data: { pipelineId, versionNumber: nextNumber, label: `Version ${nextNumber}`, isActive: true, publishedAt: new Date() },
      });

      if (latest?.stages?.length) {
        for (const stage of latest.stages) {
          await tx.crmPipelineStage.create({
            data: {
              versionId: version.id,
              name: stage.name,
              sortOrder: stage.sortOrder,
              category: stage.category,
              probability: stage.probability,
              entryCriteria: stage.entryCriteria ?? undefined,
              exitCriteria: stage.exitCriteria ?? undefined,
              requiredFields: stage.requiredFields ?? undefined,
              maxDurationDays: stage.maxDurationDays,
              automationEligible: stage.automationEligible,
              requiresApproval: stage.requiresApproval,
            },
          });
        }
      }

      await tx.crmPipeline.update({ where: { id: pipelineId }, data: { currentVersionId: version.id } });
      return version;
    });
  },

  async addStage(
    pipelineId: string,
    brandId: string,
    organisationId: string,
    input: { name: string; category: string; sortOrder?: number; probability?: number; requiredFields?: string[] },
    context: TenantContext,
  ) {
    const pipeline = await this.getPipeline(pipelineId, brandId, organisationId, context);
    const version = pipeline.versions.find((v) => v.isActive) ?? pipeline.versions[0];
    if (!version) throw new AppError("VALIDATION_ERROR", "No active pipeline version.");

    return prisma.crmPipelineStage.create({
      data: {
        versionId: version.id,
        name: input.name,
        category: input.category as Prisma.CrmPipelineStageCreateInput["category"],
        sortOrder: input.sortOrder ?? version.stages.length,
        probability: input.probability ?? DEFAULT_STAGE_PROBABILITIES[input.category] ?? 10,
        requiredFields: input.requiredFields as Prisma.InputJsonValue,
      },
    });
  },

  async listLossReasons(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.crmOpportunityLossReason.findMany({
      where: { organisationId, OR: [{ brandId }, { brandId: null }], isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  },

  async createLossReason(
    brandId: string,
    organisationId: string,
    input: { label: string; reEngagementDefault?: boolean },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.crmOpportunityLossReason.create({
      data: {
        organisationId,
        brandId,
        label: input.label,
        reEngagementDefault: input.reEngagementDefault ?? false,
      },
    });
  },
};
