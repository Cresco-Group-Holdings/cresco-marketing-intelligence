import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";

const ids = {
  organisationId: "org-dam-1",
  projectId: "project-dam-1",
  brandId: "brand-dam-1",
  assetId: "asset-dam-1",
  userProfileId: "profile-dam-1",
};

const tenant: TenantContext = {
  userId: "auth-dam-1",
  userProfileId: ids.userProfileId,
  organisationId: ids.organisationId,
  organisationRole: OrganisationRole.OWNER,
};

const prismaMock = vi.hoisted(() => ({
  digitalAsset: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  digitalAssetVersion: { create: vi.fn() },
  digitalAssetUsage: { count: vi.fn(), findMany: vi.fn() },
  digitalAssetActivity: { create: vi.fn() },
  digitalAssetProcessingJob: { upsert: vi.fn() },
  contentCampaign: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/audit-service", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: { getById: vi.fn() },
}));
vi.mock("@/lib/storage/supabase-storage-provider", () => ({
  createObjectStorageProvider: () => ({
    upload: vi.fn(),
    delete: vi.fn(),
    createSignedUrl: vi.fn().mockResolvedValue({ url: "https://signed.example/a", expiresAt: new Date() }),
  }),
}));
vi.mock("@/lib/digital-assets/file-processing", () => ({
  processDigitalAssetUpload: vi.fn().mockResolvedValue({
    buffer: Buffer.from("data"),
    mimeType: "image/png",
    safeFilename: "test.png",
    checksum: "abc123checksum",
    assetType: "IMAGE",
    width: 100,
    height: 100,
    durationSeconds: null,
  }),
  buildDigitalAssetStorageKey: vi.fn().mockReturnValue("org/brand/dam/key"),
}));
vi.mock("@/server/services/digital-asset-processing-service", () => ({
  digitalAssetProcessingService: { enqueueAllJobs: vi.fn() },
}));

import { digitalAssetService } from "@/server/services/digital-asset-service";
import { brandService } from "@/server/services/workspace-service";

describe("digitalAssetService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(brandService.getById).mockResolvedValue({
      id: ids.brandId,
      projectId: ids.projectId,
    } as never);
    prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
    prismaMock.digitalAssetActivity.create.mockResolvedValue({});
    prismaMock.digitalAssetProcessingJob.upsert.mockResolvedValue({});
  });

  it("rejects cross-tenant asset access", async () => {
    prismaMock.digitalAsset.findFirst.mockResolvedValue(null);
    await expect(
      digitalAssetService.getById(ids.brandId, ids.organisationId, ids.assetId, tenant),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("detects duplicate checksum on upload", async () => {
    prismaMock.digitalAsset.findFirst.mockResolvedValue({
      id: "existing",
      sizeBytes: BigInt(100),
      checksum: "abc123checksum",
    });

    const result = await digitalAssetService.upload(
      ids.brandId,
      ids.organisationId,
      { filename: "test.png", buffer: Buffer.from("data") },
      tenant,
    );

    expect(result.duplicate).toBe(true);
    expect(prismaMock.digitalAsset.create).not.toHaveBeenCalled();
  });

  it("archives asset", async () => {
    prismaMock.digitalAsset.findFirst.mockResolvedValue({
      id: ids.assetId,
      brandId: ids.brandId,
      tagAssignments: [],
      usages: [],
      collectionItems: [],
      metadata: [],
      versions: [],
    });
    prismaMock.digitalAsset.update.mockResolvedValue({
      id: ids.assetId,
      sizeBytes: BigInt(100),
      status: "ARCHIVED",
    });

    const asset = await digitalAssetService.archive(ids.brandId, ids.organisationId, ids.assetId, tenant);
    expect(asset.status).toBe("ARCHIVED");
  });

  it("blocks deletion when actively referenced", async () => {
    prismaMock.digitalAssetUsage.count.mockResolvedValue(2);
    await expect(digitalAssetService.assertDeletable(ids.assetId)).rejects.toThrow(/actively referenced/i);
  });

  it("issues signed url only for ready assets", async () => {
    prismaMock.digitalAsset.findFirst.mockResolvedValue({
      id: ids.assetId,
      brandId: ids.brandId,
      status: "PROCESSING",
      storageKey: "key",
      tagAssignments: [],
      usages: [],
      collectionItems: [],
      metadata: [],
      versions: [],
    });

    await expect(
      digitalAssetService.createSignedUrl(ids.brandId, ids.organisationId, ids.assetId, tenant),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects cross-brand campaign association", async () => {
    prismaMock.digitalAsset.findFirst.mockResolvedValue(null);
    prismaMock.contentCampaign.findFirst.mockResolvedValue(null);

    await expect(
      digitalAssetService.upload(
        ids.brandId,
        ids.organisationId,
        { filename: "test.png", buffer: Buffer.from("data"), campaignId: "wrong-campaign" },
        tenant,
      ),
    ).rejects.toBeInstanceOf(AppError);
  });
});
