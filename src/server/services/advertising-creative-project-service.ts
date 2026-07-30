import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { CREATIVE_PROJECT_STATUS_TRANSITIONS } from "@/lib/advertising-creatives/constants";
import { getFormatSpec } from "@/lib/advertising-creatives/format-specs";
import { validateCopyField } from "@/lib/advertising-creatives/copy-limits";
import { buildProvenance } from "@/lib/advertising-creatives/provenance";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

function assertTransition(from: string, to: string) {
  const allowed = CREATIVE_PROJECT_STATUS_TRANSITIONS[from as keyof typeof CREATIVE_PROJECT_STATUS_TRANSITIONS] ?? [];
  if (!allowed.includes(to as never)) {
    throw new AppError("VALIDATION_ERROR", `Cannot transition creative project from ${from} to ${to}.`);
  }
}

const projectInclude = {
  concepts: { orderBy: { sortOrder: "asc" as const } },
  variants: { orderBy: { sortOrder: "asc" as const }, include: { copies: true, assets: true } },
  copies: true,
  assets: { include: { marketingAsset: true } },
  formats: true,
  reviews: { orderBy: { createdAt: "desc" as const }, take: 20 },
  versions: { orderBy: { versionNumber: "desc" as const }, take: 10 },
  validations: { orderBy: { createdAt: "desc" as const }, take: 10 },
  campaignPlan: { select: { id: true, name: true, primaryObjective: true } },
} satisfies Prisma.AdvertisingCreativeProjectInclude;

export const advertisingCreativeProjectService = {
  async list(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingCreativeProject.findMany({
      where: { organisationId, brandId, archivedAt: null },
      include: {
        _count: { select: { variants: true, concepts: true, reviews: true } },
        campaignPlan: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  },

  async getById(creativeId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const project = await prisma.advertisingCreativeProject.findFirst({
      where: { id: creativeId, organisationId, brandId },
      include: projectInclude,
    });
    if (!project) throw new AppError("NOT_FOUND", "Creative project not found.");
    return project;
  },

  async create(
    brandId: string,
    organisationId: string,
    input: {
      name: string;
      description?: string;
      campaignPlanId?: string;
      primaryFormat?: string;
      channelType?: string;
      objectiveType?: string;
      audienceSummary?: string;
      placementSummary?: string;
      offerSummary?: string;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    if (input.campaignPlanId) {
      const plan = await prisma.advertisingCampaignPlan.findFirst({
        where: { id: input.campaignPlanId, organisationId, brandId },
      });
      if (!plan) throw new AppError("NOT_FOUND", "Campaign plan not found.");
    }

    const project = await prisma.advertisingCreativeProject.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        campaignPlanId: input.campaignPlanId,
        name: input.name,
        description: input.description,
        primaryFormat: input.primaryFormat as Prisma.AdvertisingCreativeProjectCreateInput["primaryFormat"],
        channelType: input.channelType as Prisma.AdvertisingCreativeProjectCreateInput["channelType"],
        objectiveType: input.objectiveType as Prisma.AdvertisingCreativeProjectCreateInput["objectiveType"],
        audienceSummary: input.audienceSummary,
        placementSummary: input.placementSummary,
        offerSummary: input.offerSummary,
        ownerUserId: context.userProfileId,
        createdByUserId: context.userProfileId,
        status: "DRAFT",
      },
    });

    if (input.primaryFormat) {
      const spec = getFormatSpec(input.primaryFormat as never);
      await prisma.advertisingCreativeFormat.create({
        data: {
          organisationId,
          creativeProjectId: project.id,
          formatType: input.primaryFormat as never,
          channelType: input.channelType as Prisma.AdvertisingCreativeFormatCreateInput["channelType"],
          aspectRatio: spec.aspectRatio,
          resolution: spec.resolution,
          maxFileSizeBytes: spec.maxFileSizeBytes,
          maxDurationSeconds: spec.maxDurationSeconds,
          textLimits: spec.textLimits as Prisma.InputJsonValue,
          audioRequired: spec.audioRequired ?? false,
          subtitlesRequired: spec.subtitlesRequired ?? false,
          thumbnailRequired: spec.thumbnailRequired ?? false,
          safeZones: spec.safeZones as Prisma.InputJsonValue,
        },
      });
    }

    return project;
  },

  async addVariant(
    creativeId: string,
    brandId: string,
    organisationId: string,
    input: {
      conceptId?: string;
      variantLabel: string;
      hypothesis?: string;
      hook?: string;
      headline?: string;
      primaryText?: string;
      cta?: string;
    },
    context: TenantContext,
  ) {
    await this.getById(creativeId, brandId, organisationId, context);
    return prisma.advertisingCreativeVariant.create({
      data: {
        organisationId,
        creativeProjectId: creativeId,
        conceptId: input.conceptId,
        variantLabel: input.variantLabel,
        hypothesis: input.hypothesis,
        hook: input.hook,
        headline: input.headline,
        primaryText: input.primaryText,
        cta: input.cta,
      },
    });
  },

  async upsertCopy(
    creativeId: string,
    brandId: string,
    organisationId: string,
    input: { variantId?: string; fieldKey: string; fieldValue: string; isLocked?: boolean },
    context: TenantContext,
  ) {
    const project = await this.getById(creativeId, brandId, organisationId, context);
    const format = project.formats[0];
    const textLimits = (format?.textLimits ?? {}) as Record<string, number>;
    const maxLength = textLimits[input.fieldKey] ?? null;
    const validation = validateCopyField(input.fieldKey as never, input.fieldValue, maxLength);

    const existing = await prisma.advertisingCreativeCopy.findFirst({
      where: {
        creativeProjectId: creativeId,
        variantId: input.variantId ?? null,
        fieldKey: input.fieldKey,
      },
    });

    if (existing) {
      return prisma.advertisingCreativeCopy.update({
        where: { id: existing.id },
        data: {
          fieldValue: input.fieldValue,
          characterCount: validation.characterCount,
          maxLength,
          isLocked: input.isLocked ?? existing.isLocked,
          truncationWarning: validation.truncationWarning,
        },
      });
    }

    return prisma.advertisingCreativeCopy.create({
      data: {
        organisationId,
        creativeProjectId: creativeId,
        variantId: input.variantId,
        fieldKey: input.fieldKey,
        fieldValue: input.fieldValue,
        characterCount: validation.characterCount,
        maxLength,
        providerLimit: maxLength,
        isLocked: input.isLocked ?? false,
        truncationWarning: validation.truncationWarning,
      },
    });
  },

  async attachAsset(
    creativeId: string,
    brandId: string,
    organisationId: string,
    input: {
      variantId?: string;
      marketingAssetId?: string;
      visualProjectId?: string;
      source: string;
      isSynthetic?: boolean;
    },
    context: TenantContext,
  ) {
    await this.getById(creativeId, brandId, organisationId, context);

    if (input.marketingAssetId) {
      const asset = await prisma.marketingAsset.findFirst({
        where: { id: input.marketingAssetId, brandId, organisationId },
      });
      if (!asset) throw new AppError("NOT_FOUND", "Marketing asset not found.");
      if (asset.organisationId !== organisationId) {
        throw new AppError("FORBIDDEN", "Asset belongs to another organisation.");
      }
    }

    const provenance = buildProvenance({
      source: input.source as never,
      isSynthetic: input.isSynthetic,
      marketingAssetId: input.marketingAssetId,
      visualProjectId: input.visualProjectId,
    });

    return prisma.advertisingCreativeAsset.create({
      data: {
        organisationId,
        creativeProjectId: creativeId,
        variantId: input.variantId,
        marketingAssetId: input.marketingAssetId,
        visualProjectId: input.visualProjectId,
        source: provenance.source,
        isSynthetic: provenance.isSynthetic,
        provenanceLabel: provenance.provenanceLabel,
        syntheticDisclaimer: provenance.syntheticDisclaimer,
      },
    });
  },

  async createVersion(creativeId: string, brandId: string, organisationId: string, context: TenantContext, changeNote?: string) {
    const project = await this.getById(creativeId, brandId, organisationId, context);
    const versionNumber = (project.versions[0]?.versionNumber ?? 0) + 1;
    const snapshot = {
      concepts: project.concepts,
      variants: project.variants,
      copies: project.copies,
      assets: project.assets.map((a) => ({ id: a.id, source: a.source, provenanceLabel: a.provenanceLabel })),
      formats: project.formats,
    };

    return prisma.advertisingCreativeVersion.create({
      data: {
        organisationId,
        creativeProjectId: creativeId,
        versionNumber,
        status: project.status,
        snapshot: snapshot as Prisma.InputJsonValue,
        changeNote,
        createdByUserId: context.userProfileId,
      },
    });
  },

  async updateStatus(creativeId: string, brandId: string, organisationId: string, newStatus: string, context: TenantContext) {
    const project = await this.getById(creativeId, brandId, organisationId, context);
    assertTransition(project.status, newStatus);
    return prisma.advertisingCreativeProject.update({
      where: { id: creativeId },
      data: { status: newStatus as Prisma.AdvertisingCreativeProjectUpdateInput["status"] },
    });
  },
};
