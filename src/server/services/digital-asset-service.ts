import {
  DigitalAssetActivityAction,
  DigitalAssetProcessingJobStatus,
  DigitalAssetProcessingJobType,
  DigitalAssetStatus,
  Prisma,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { DIGITAL_ASSET_SIGNED_URL_TTL_SECONDS } from "@/lib/digital-assets/constants";
import {
  buildDigitalAssetStorageKey,
  processDigitalAssetUpload,
} from "@/lib/digital-assets/file-processing";
import type {
  DigitalAssetBulkArchiveInput,
  DigitalAssetCollectionCreateInput,
  DigitalAssetListQuery,
  DigitalAssetTagCreateInput,
  DigitalAssetUpdateInput,
  DigitalAssetUsageCreateInput,
} from "@/lib/validation/digital-assets";
import { createObjectStorageProvider } from "@/lib/storage/supabase-storage-provider";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";
import { digitalAssetProcessingService } from "@/server/services/digital-asset-processing-service";

type BrandScope = {
  organisationId: string;
  projectId: string;
  brandId: string;
};

const ACTIVE_ONLY = { archivedAt: null } as const;

async function resolveBrandScope(
  brandId: string,
  organisationId: string,
  context: TenantContext,
): Promise<BrandScope> {
  const brand = await brandService.getById(brandId, organisationId, context);
  return { organisationId, projectId: brand.projectId, brandId };
}

async function getAssetForBrand(assetId: string, scope: BrandScope, includeArchived = false) {
  const asset = await prisma.digitalAsset.findFirst({
    where: {
      id: assetId,
      organisationId: scope.organisationId,
      brandId: scope.brandId,
      ...(includeArchived ? {} : ACTIVE_ONLY),
    },
    include: {
      createdBy: { select: { id: true, displayName: true, email: true } },
      tagAssignments: { include: { tag: true } },
      usages: { where: { removedAt: null } },
      collectionItems: { include: { collection: true } },
      metadata: true,
      versions: { orderBy: { version: "desc" }, take: 10 },
    },
  });

  if (!asset) {
    throw new AppError("NOT_FOUND", "Digital asset was not found.");
  }

  return asset;
}

async function recordAssetActivity(
  organisationId: string,
  assetId: string,
  actorUserId: string,
  action: DigitalAssetActivityAction,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await prisma.digitalAssetActivity.create({
    data: {
      organisationId,
      assetId,
      actorUserId,
      action,
      metadata: metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

async function assertCampaignBelongsToBrand(
  campaignId: string | null | undefined,
  scope: BrandScope,
): Promise<void> {
  if (!campaignId) return;
  const campaign = await prisma.contentCampaign.findFirst({
    where: {
      id: campaignId,
      organisationId: scope.organisationId,
      brandId: scope.brandId,
      archivedAt: null,
    },
    select: { id: true },
  });
  if (!campaign) {
    throw new AppError("VALIDATION_ERROR", "Campaign was not found for this brand.");
  }
}

async function assertNoActiveUsages(assetId: string): Promise<void> {
  const count = await prisma.digitalAssetUsage.count({
    where: { assetId, removedAt: null },
  });
  if (count > 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Asset is actively referenced and cannot be deleted. Archive it instead.",
    );
  }
}

function serializeAsset<T extends { sizeBytes: bigint }>(asset: T) {
  return { ...asset, sizeBytes: Number(asset.sizeBytes) };
}

export const digitalAssetService = {
  async list(
    brandId: string,
    organisationId: string,
    context: TenantContext,
    query?: Partial<DigitalAssetListQuery>,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const filters = query ?? {};

    const assets = await prisma.digitalAsset.findMany({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        ...(filters.includeArchived ? {} : ACTIVE_ONLY),
        ...(filters.status ? { status: filters.status } : { status: { not: DigitalAssetStatus.ARCHIVED } }),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
        ...(filters.tagId ? { tagAssignments: { some: { tagId: filters.tagId } } } : {}),
        ...(filters.collectionId
          ? { collectionItems: { some: { collectionId: filters.collectionId } } }
          : {}),
        ...(filters.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: "insensitive" } },
                { description: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        createdBy: { select: { id: true, displayName: true, email: true } },
        tagAssignments: { include: { tag: true } },
        usages: { where: { removedAt: null } },
      },
      orderBy: { createdAt: "desc" },
    });

    return assets.map(serializeAsset);
  },

  async getById(brandId: string, organisationId: string, assetId: string, context: TenantContext) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const asset = await getAssetForBrand(assetId, scope);
    return serializeAsset(asset);
  },

  async upload(
    brandId: string,
    organisationId: string,
    input: {
      filename: string;
      buffer: Buffer;
      name?: string;
      description?: string;
      type?: import("@prisma/client").DigitalAssetType;
      campaignId?: string;
      tagIds?: string[];
    },
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    await assertCampaignBelongsToBrand(input.campaignId, scope);

    const processed = await processDigitalAssetUpload(input.filename, input.buffer, input.type);

    const duplicate = await prisma.digitalAsset.findFirst({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        checksum: processed.checksum,
        archivedAt: null,
        status: { in: [DigitalAssetStatus.READY, DigitalAssetStatus.PROCESSING] },
      },
    });

    if (duplicate) {
      return {
        asset: serializeAsset(duplicate),
        duplicate: true,
      };
    }

    const assetId = randomUUID();
    const storageKey = buildDigitalAssetStorageKey(
      scope.organisationId,
      scope.brandId,
      assetId,
      processed.safeFilename,
    );

    const storage = createObjectStorageProvider();

    try {
      await storage.upload({
        key: storageKey,
        body: processed.buffer,
        contentType: processed.mimeType,
      });

      const asset = await prisma.digitalAsset.create({
        data: {
          id: assetId,
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          campaignId: input.campaignId ?? null,
          name: input.name?.trim() || processed.safeFilename,
          description: input.description?.trim() || null,
          type: processed.assetType,
          status: DigitalAssetStatus.PROCESSING,
          storageKey,
          mimeType: processed.mimeType,
          sizeBytes: BigInt(processed.buffer.byteLength),
          width: processed.width,
          height: processed.height,
          durationSeconds: processed.durationSeconds,
          checksum: processed.checksum,
          createdByUserId: context.userProfileId,
          versions: {
            create: {
              organisationId: scope.organisationId,
              version: 1,
              storageKey,
              mimeType: processed.mimeType,
              sizeBytes: BigInt(processed.buffer.byteLength),
              checksum: processed.checksum,
              width: processed.width,
              height: processed.height,
              durationSeconds: processed.durationSeconds,
              uploadedByUserId: context.userProfileId,
            },
          },
          tagAssignments: input.tagIds?.length
            ? { create: input.tagIds.map((tagId) => ({ tagId })) }
            : undefined,
        },
        include: {
          createdBy: { select: { id: true, displayName: true, email: true } },
        },
      });

      await digitalAssetProcessingService.enqueueAllJobs(asset.id, scope.organisationId, 1);

      await recordAssetActivity(scope.organisationId, asset.id, context.userProfileId, "UPLOADED");
      await recordAuditEvent({
        organisationId: scope.organisationId,
        projectId: scope.projectId,
        actorUserId: context.userProfileId,
        action: "digitalAsset.uploaded",
        resourceType: "DigitalAsset",
        resourceId: asset.id,
        requestId,
      });

      return { asset: serializeAsset(asset), duplicate: false };
    } catch (error) {
      try {
        await storage.delete(storageKey);
      } catch {
        // best effort
      }
      throw error;
    }
  },

  async replaceVersion(
    brandId: string,
    organisationId: string,
    assetId: string,
    input: { filename: string; buffer: Buffer },
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const existing = await getAssetForBrand(assetId, scope);

    if (existing.status === DigitalAssetStatus.ARCHIVED) {
      throw new AppError("VALIDATION_ERROR", "Archived assets cannot be updated.");
    }

    const processed = await processDigitalAssetUpload(input.filename, input.buffer, existing.type);
    const nextVersion = existing.version + 1;
    const storageKey = buildDigitalAssetStorageKey(
      scope.organisationId,
      scope.brandId,
      assetId,
      processed.safeFilename,
      nextVersion,
    );

    const storage = createObjectStorageProvider();
    await storage.upload({ key: storageKey, body: processed.buffer, contentType: processed.mimeType });

    const asset = await prisma.$transaction(async (tx) => {
      await tx.digitalAssetVersion.create({
        data: {
          assetId,
          organisationId: scope.organisationId,
          version: nextVersion,
          storageKey,
          mimeType: processed.mimeType,
          sizeBytes: BigInt(processed.buffer.byteLength),
          checksum: processed.checksum,
          width: processed.width,
          height: processed.height,
          durationSeconds: processed.durationSeconds,
          uploadedByUserId: context.userProfileId,
        },
      });

      return tx.digitalAsset.update({
        where: { id: assetId },
        data: {
          storageKey,
          mimeType: processed.mimeType,
          sizeBytes: BigInt(processed.buffer.byteLength),
          checksum: processed.checksum,
          width: processed.width,
          height: processed.height,
          version: nextVersion,
          status: DigitalAssetStatus.PROCESSING,
          thumbnailStorageKey: null,
        },
      });
    });

    await digitalAssetProcessingService.enqueueAllJobs(assetId, scope.organisationId, nextVersion);
    await recordAssetActivity(scope.organisationId, assetId, context.userProfileId, "VERSION_REPLACED", {
      version: nextVersion,
    });
    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "digitalAsset.versionReplaced",
      resourceType: "DigitalAsset",
      resourceId: assetId,
      requestId,
    });

    return serializeAsset(asset);
  },

  async update(
    brandId: string,
    organisationId: string,
    assetId: string,
    input: DigitalAssetUpdateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    await getAssetForBrand(assetId, scope);
    if (input.campaignId !== undefined) {
      await assertCampaignBelongsToBrand(input.campaignId, scope);
    }

    const asset = await prisma.digitalAsset.update({
      where: { id: assetId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.campaignId !== undefined ? { campaignId: input.campaignId } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
      },
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "digitalAsset.updated",
      resourceType: "DigitalAsset",
      resourceId: assetId,
      requestId,
    });

    return serializeAsset(asset);
  },

  async archive(
    brandId: string,
    organisationId: string,
    assetId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    await getAssetForBrand(assetId, scope);

    const asset = await prisma.digitalAsset.update({
      where: { id: assetId },
      data: {
        status: DigitalAssetStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    await recordAssetActivity(scope.organisationId, assetId, context.userProfileId, "ARCHIVED");
    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "digitalAsset.archived",
      resourceType: "DigitalAsset",
      resourceId: assetId,
      requestId,
    });

    return serializeAsset(asset);
  },

  async restore(
    brandId: string,
    organisationId: string,
    assetId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const existing = await getAssetForBrand(assetId, scope, true);

    if (existing.status !== DigitalAssetStatus.ARCHIVED) {
      throw new AppError("VALIDATION_ERROR", "Only archived assets can be restored.");
    }

    const asset = await prisma.digitalAsset.update({
      where: { id: assetId },
      data: {
        status: DigitalAssetStatus.READY,
        archivedAt: null,
      },
    });

    await recordAssetActivity(scope.organisationId, assetId, context.userProfileId, "RESTORED");
    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "digitalAsset.restored",
      resourceType: "DigitalAsset",
      resourceId: assetId,
      requestId,
    });

    return serializeAsset(asset);
  },

  async bulkArchive(
    brandId: string,
    organisationId: string,
    input: DigitalAssetBulkArchiveInput,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);

    const result = await prisma.digitalAsset.updateMany({
      where: {
        id: { in: input.assetIds },
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        archivedAt: null,
      },
      data: {
        status: DigitalAssetStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    for (const assetId of input.assetIds) {
      await recordAssetActivity(scope.organisationId, assetId, context.userProfileId, "BULK_ARCHIVED");
    }

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "digitalAsset.bulkArchived",
      resourceType: "DigitalAsset",
      requestId,
      metadata: { count: result.count },
    });

    return { archivedCount: result.count };
  },

  async createSignedUrl(
    brandId: string,
    organisationId: string,
    assetId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const asset = await getAssetForBrand(assetId, scope);

    if (asset.status !== DigitalAssetStatus.READY) {
      throw new AppError("NOT_FOUND", "Asset is not available for download.");
    }

    const storage = createObjectStorageProvider();
    const signed = await storage.createSignedUrl(asset.storageKey, DIGITAL_ASSET_SIGNED_URL_TTL_SECONDS);

    await recordAssetActivity(scope.organisationId, assetId, context.userProfileId, "DOWNLOADED");
    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "digitalAsset.accessUrlIssued",
      resourceType: "DigitalAsset",
      resourceId: assetId,
      requestId,
    });

    return signed;
  },

  async listVersions(brandId: string, organisationId: string, assetId: string, context: TenantContext) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    await getAssetForBrand(assetId, scope);

    const versions = await prisma.digitalAssetVersion.findMany({
      where: { assetId, organisationId: scope.organisationId },
      include: { uploadedBy: { select: { id: true, displayName: true, email: true } } },
      orderBy: { version: "desc" },
    });

    return versions.map((v) => ({ ...v, sizeBytes: Number(v.sizeBytes) }));
  },

  async listActivity(brandId: string, organisationId: string, assetId: string, context: TenantContext) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    await getAssetForBrand(assetId, scope);

    return prisma.digitalAssetActivity.findMany({
      where: { assetId, organisationId: scope.organisationId },
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  tags: {
    async list(brandId: string, organisationId: string, context: TenantContext) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      return prisma.digitalAssetTag.findMany({
        where: { organisationId: scope.organisationId, brandId: scope.brandId },
        orderBy: { name: "asc" },
      });
    },

    async create(
      brandId: string,
      organisationId: string,
      input: DigitalAssetTagCreateInput,
      context: TenantContext,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      return prisma.digitalAssetTag.create({
        data: {
          organisationId: scope.organisationId,
          brandId: scope.brandId,
          name: input.name,
          colour: input.colour ?? null,
        },
      });
    },

    async assign(
      brandId: string,
      organisationId: string,
      assetId: string,
      tagId: string,
      context: TenantContext,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getAssetForBrand(assetId, scope);

      const assignment = await prisma.digitalAssetTagAssignment.upsert({
        where: { assetId_tagId: { assetId, tagId } },
        create: { assetId, tagId },
        update: {},
      });

      await recordAssetActivity(scope.organisationId, assetId, context.userProfileId, "TAG_ADDED", { tagId });
      return assignment;
    },
  },

  collections: {
    async list(brandId: string, organisationId: string, context: TenantContext) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      return prisma.digitalAssetCollection.findMany({
        where: { organisationId: scope.organisationId, brandId: scope.brandId },
        include: { _count: { select: { items: true } } },
        orderBy: { name: "asc" },
      });
    },

    async create(
      brandId: string,
      organisationId: string,
      input: DigitalAssetCollectionCreateInput,
      context: TenantContext,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      return prisma.digitalAssetCollection.create({
        data: {
          organisationId: scope.organisationId,
          brandId: scope.brandId,
          name: input.name,
          description: input.description ?? null,
          createdByUserId: context.userProfileId,
        },
      });
    },

    async addAsset(
      brandId: string,
      organisationId: string,
      collectionId: string,
      assetId: string,
      context: TenantContext,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getAssetForBrand(assetId, scope);

      const item = await prisma.digitalAssetCollectionItem.upsert({
        where: { collectionId_assetId: { collectionId, assetId } },
        create: { collectionId, assetId },
        update: {},
      });

      await recordAssetActivity(scope.organisationId, assetId, context.userProfileId, "COLLECTION_ADDED", {
        collectionId,
      });
      return item;
    },
  },

  usages: {
    async list(brandId: string, organisationId: string, assetId: string, context: TenantContext) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getAssetForBrand(assetId, scope);

      return prisma.digitalAssetUsage.findMany({
        where: { assetId, organisationId: scope.organisationId, removedAt: null },
        orderBy: { createdAt: "desc" },
      });
    },

    async record(
      brandId: string,
      organisationId: string,
      assetId: string,
      input: DigitalAssetUsageCreateInput,
      context: TenantContext,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getAssetForBrand(assetId, scope);

      const usage = await prisma.digitalAssetUsage.upsert({
        where: {
          assetId_entityType_entityId: {
            assetId,
            entityType: input.entityType,
            entityId: input.entityId,
          },
        },
        create: {
          assetId,
          organisationId: scope.organisationId,
          entityType: input.entityType,
          entityId: input.entityId,
          usageRole: input.usageRole ?? null,
        },
        update: {
          usageRole: input.usageRole ?? null,
          removedAt: null,
        },
      });

      await recordAssetActivity(scope.organisationId, assetId, context.userProfileId, "USAGE_RECORDED", {
        entityType: input.entityType,
        entityId: input.entityId,
      });

      return usage;
    },

    async remove(
      brandId: string,
      organisationId: string,
      assetId: string,
      usageId: string,
      context: TenantContext,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      await getAssetForBrand(assetId, scope);

      await prisma.digitalAssetUsage.update({
        where: { id: usageId },
        data: { removedAt: new Date() },
      });

      await recordAssetActivity(scope.organisationId, assetId, context.userProfileId, "USAGE_REMOVED", {
        usageId,
      });
    },
  },

  async assertDeletable(assetId: string): Promise<void> {
    await assertNoActiveUsages(assetId);
  },
};
