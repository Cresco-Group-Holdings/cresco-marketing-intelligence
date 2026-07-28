import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarketingAssetStatus, OrganisationRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";

const testIds = {
  organisationId: "org-1",
  projectId: "project-1",
  brandId: "brand-1",
  userProfileId: "profile-1",
};

const tenantContext: TenantContext = {
  userId: "auth-user-1",
  userProfileId: testIds.userProfileId,
  organisationId: testIds.organisationId,
  organisationRole: OrganisationRole.OWNER,
};

const prismaMock = vi.hoisted(() => ({
  marketingAsset: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

const storageMock = vi.hoisted(() => ({
  upload: vi.fn(),
  delete: vi.fn(),
  createSignedUrl: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/storage/supabase-storage-provider", () => ({
  createObjectStorageProvider: () => storageMock,
}));

vi.mock("@/lib/marketing-assets/file-processing", () => ({
  processMarketingAssetUpload: vi.fn(),
  buildMarketingAssetStorageKey: vi.fn(
    (organisationId: string, brandId: string, assetId: string, filename: string) =>
      `${organisationId}/${brandId}/${assetId}/${filename}`,
  ),
}));

vi.mock("@/server/services/audit-service", () => ({
  recordAuditEvent: vi.fn(),
}));

vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn(),
  },
}));

import { marketingAssetService } from "@/server/services/marketing-asset-service";
import { brandService } from "@/server/services/workspace-service";
import { processMarketingAssetUpload } from "@/lib/marketing-assets/file-processing";

describe("marketingAssetService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(brandService.getById).mockResolvedValue({
      id: testIds.brandId,
      organisationId: testIds.organisationId,
      projectId: testIds.projectId,
      name: "Test Brand",
      slug: "test-brand",
      description: null,
      website: null,
      primaryDomain: null,
      logoUrl: null,
      faviconUrl: null,
      primaryColour: null,
      secondaryColour: null,
      accentColour: null,
      status: "ACTIVE",
      createdByUserId: testIds.userProfileId,
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
      profile: null,
    });
  });

  it("rejects cross-tenant asset access", async () => {
    prismaMock.marketingAsset.findFirst.mockResolvedValue({
      id: "asset-1",
      brandId: "other-brand",
      organisationId: testIds.organisationId,
      status: MarketingAssetStatus.READY,
      storageKey: "key",
      archivedAt: null,
    });

    await expect(
      marketingAssetService.createSignedAccessUrl(
        testIds.brandId,
        testIds.organisationId,
        "asset-1",
        tenantContext,
      ),
    ).rejects.toThrow(AppError);
  });

  it("uploads assets with tenant-scoped storage keys", async () => {
    vi.mocked(processMarketingAssetUpload).mockResolvedValue({
      buffer: Buffer.from("png"),
      mimeType: "image/png",
      assetType: "IMAGE",
      width: 100,
      height: 100,
      durationSeconds: null,
      safeFilename: "logo.png",
    });
    storageMock.upload.mockResolvedValue(undefined);
    prismaMock.marketingAsset.create.mockResolvedValue({
      id: "asset-1",
      title: "Logo",
      storageKey: `${testIds.organisationId}/${testIds.brandId}/asset-1/logo.png`,
    });

    const asset = await marketingAssetService.upload(
      testIds.brandId,
      testIds.organisationId,
      { filename: "logo.png", buffer: Buffer.from("png") },
      tenantContext,
    );

    expect(asset.title).toBe("Logo");
    expect(storageMock.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "image/png",
      }),
    );
  });

  it("issues signed URLs with expiry metadata", async () => {
    const expiresAt = new Date(Date.now() + 300_000);
    prismaMock.marketingAsset.findFirst.mockResolvedValue({
      id: "asset-1",
      brandId: testIds.brandId,
      organisationId: testIds.organisationId,
      status: MarketingAssetStatus.READY,
      storageKey: "org-1/brand-1/asset-1/logo.png",
      archivedAt: null,
    });
    storageMock.createSignedUrl.mockResolvedValue({
      url: "https://signed.example/logo.png",
      expiresAt,
    });

    const signed = await marketingAssetService.createSignedAccessUrl(
      testIds.brandId,
      testIds.organisationId,
      "asset-1",
      tenantContext,
    );

    expect(signed.url).toContain("https://signed.example");
    expect(signed.expiresAt).toEqual(expiresAt);
  });

  it("archives assets and removes storage objects", async () => {
    prismaMock.marketingAsset.findFirst.mockResolvedValue({
      id: "asset-1",
      brandId: testIds.brandId,
      organisationId: testIds.organisationId,
      storageKey: "org-1/brand-1/asset-1/logo.png",
      archivedAt: null,
    });
    prismaMock.marketingAsset.update.mockResolvedValue({
      id: "asset-1",
      status: MarketingAssetStatus.ARCHIVED,
      archivedAt: new Date(),
    });
    storageMock.delete.mockResolvedValue(undefined);

    const asset = await marketingAssetService.archive(
      testIds.brandId,
      testIds.organisationId,
      "asset-1",
      tenantContext,
    );

    expect(asset.status).toBe(MarketingAssetStatus.ARCHIVED);
    expect(storageMock.delete).toHaveBeenCalledWith("org-1/brand-1/asset-1/logo.png");
  });

  it("rejects signed URLs for archived assets", async () => {
    prismaMock.marketingAsset.findFirst.mockResolvedValue({
      id: "asset-1",
      brandId: testIds.brandId,
      organisationId: testIds.organisationId,
      status: MarketingAssetStatus.ARCHIVED,
      storageKey: "key",
      archivedAt: new Date(),
    });

    await expect(
      marketingAssetService.createSignedAccessUrl(
        testIds.brandId,
        testIds.organisationId,
        "asset-1",
        tenantContext,
      ),
    ).rejects.toThrow(/not available/i);
  });
});
