import { MarketingAssetStatus, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  buildMarketingAssetStorageKey,
  processMarketingAssetUpload,
} from "@/lib/marketing-assets/file-processing";
import { MARKETING_ASSET_SIGNED_URL_TTL_SECONDS } from "@/lib/marketing-assets/constants";
import type { MarketingAssetListQuery, MarketingAssetUpdateInput } from "@/lib/validation/marketing-assets";
import { createObjectStorageProvider } from "@/lib/storage/supabase-storage-provider";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";

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
  return {
    organisationId,
    projectId: brand.projectId,
    brandId,
  };
}

async function getAssetForBrand(
  assetId: string,
  scope: BrandScope,
  includeArchived = false,
) {
  const asset = await prisma.marketingAsset.findFirst({
    where: {
      id: assetId,
      organisationId: scope.organisationId,
      brandId: scope.brandId,
      ...(includeArchived ? {} : ACTIVE_ONLY),
    },
    include: {
      uploadedBy: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });

  if (!asset) {
    throw new AppError("NOT_FOUND", "Marketing asset was not found.");
  }

  if (asset.brandId !== scope.brandId) {
    throw new AppError("NOT_FOUND", "Marketing asset was not found.");
  }

  return asset;
}

export const marketingAssetService = {
  async list(
    brandId: string,
    organisationId: string,
    context: TenantContext,
    query?: Partial<MarketingAssetListQuery>,
  ) {
    const filters = query ?? {};
    const scope = await resolveBrandScope(brandId, organisationId, context);

    return prisma.marketingAsset.findMany({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        ...(filters.status ? { status: filters.status } : { status: { not: MarketingAssetStatus.ARCHIVED } }),
        ...(filters.assetType ? { assetType: filters.assetType } : {}),
        ...(filters.approvedForMarketing !== undefined
          ? { approvedForMarketing: filters.approvedForMarketing }
          : {}),
        ...(filters.tag ? { tags: { has: filters.tag } } : {}),
        archivedAt: filters.status === "ARCHIVED" ? { not: null } : null,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async getById(
    brandId: string,
    organisationId: string,
    assetId: string,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    return getAssetForBrand(assetId, scope);
  },

  async upload(
    brandId: string,
    organisationId: string,
    input: {
      filename: string;
      buffer: Buffer;
      title?: string;
      description?: string;
      tags?: string[];
    },
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const processed = await processMarketingAssetUpload(input.filename, input.buffer);
    const assetId = randomUUID();
    const storageKey = buildMarketingAssetStorageKey(
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

      const asset = await prisma.marketingAsset.create({
        data: {
          id: assetId,
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          filename: processed.safeFilename,
          originalFilename: input.filename,
          storageKey,
          mimeType: processed.mimeType,
          sizeBytes: processed.buffer.byteLength,
          width: processed.width,
          height: processed.height,
          durationSeconds: processed.durationSeconds,
          assetType: processed.assetType,
          title: input.title?.trim() || processed.safeFilename,
          description: input.description?.trim() || null,
          tags: input.tags ?? [],
          status: MarketingAssetStatus.READY,
          uploadedByUserId: context.userProfileId,
        },
        include: {
          uploadedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      await recordAuditEvent({
        organisationId: scope.organisationId,
        projectId: scope.projectId,
        actorUserId: context.userProfileId,
        action: "marketingAsset.uploaded",
        resourceType: "marketingAsset",
        resourceId: asset.id,
        requestId,
        metadata: {
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
        },
      });

      return asset;
    } catch (error) {
      try {
        await storage.delete(storageKey);
      } catch {
        // Best-effort cleanup after failed DB write.
      }
      throw error;
    }
  },

  async update(
    brandId: string,
    organisationId: string,
    assetId: string,
    input: MarketingAssetUpdateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    await getAssetForBrand(assetId, scope);

    const asset = await prisma.marketingAsset.update({
      where: { id: assetId },
      data: {
        title: input.title,
        description: input.description,
        tags: input.tags,
        approvedForMarketing: input.approvedForMarketing,
        approvedPlatforms: input.approvedPlatforms,
        licenceOwner: input.licenceOwner,
        licenceNotes: input.licenceNotes,
        licenceExpiresAt:
          input.licenceExpiresAt === undefined
            ? undefined
            : input.licenceExpiresAt
              ? new Date(input.licenceExpiresAt)
              : null,
        attributionRequired: input.attributionRequired,
        consentNotes: input.consentNotes,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "marketingAsset.updated",
      resourceType: "marketingAsset",
      resourceId: asset.id,
      requestId,
    });

    return asset;
  },

  async archive(
    brandId: string,
    organisationId: string,
    assetId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const existing = await getAssetForBrand(assetId, scope);

    const asset = await prisma.marketingAsset.update({
      where: { id: assetId },
      data: {
        status: MarketingAssetStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    const storage = createObjectStorageProvider();
    try {
      await storage.delete(existing.storageKey);
    } catch {
      // Archiving remains successful even if storage cleanup fails.
    }

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "marketingAsset.archived",
      resourceType: "marketingAsset",
      resourceId: asset.id,
      requestId,
    });

    return asset;
  },

  async createSignedAccessUrl(
    brandId: string,
    organisationId: string,
    assetId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const asset = await getAssetForBrand(assetId, scope);

    if (asset.status === MarketingAssetStatus.ARCHIVED || asset.status === MarketingAssetStatus.REJECTED) {
      throw new AppError("NOT_FOUND", "Marketing asset is not available.");
    }

    const storage = createObjectStorageProvider();
    const signed = await storage.createSignedUrl(
      asset.storageKey,
      MARKETING_ASSET_SIGNED_URL_TTL_SECONDS,
    );

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "marketingAsset.accessUrlIssued",
      resourceType: "marketingAsset",
      resourceId: asset.id,
      requestId,
    });

    return signed;
  },
};
