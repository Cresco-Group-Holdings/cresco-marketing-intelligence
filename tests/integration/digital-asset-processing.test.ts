import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  digitalAssetProcessingJob: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  digitalAsset: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  digitalAssetMetadata: { upsert: vi.fn() },
  digitalAssetActivity: { create: vi.fn() },
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/storage/supabase-storage-provider", () => ({
  createObjectStorageProvider: () => ({
    createSignedUrl: vi.fn().mockResolvedValue({ url: "https://example.com/file", expiresAt: new Date() }),
    upload: vi.fn(),
  }),
}));
vi.mock("@/lib/marketing-assets/malware-scanner", () => ({
  createMalwareScanner: () => ({ scan: vi.fn().mockResolvedValue({ clean: true }) }),
}));

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: async () => Buffer.from("file-data").buffer,
}) as unknown as typeof fetch;

import { digitalAssetProcessingService } from "@/server/services/digital-asset-processing-service";

describe("digitalAssetProcessingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.digitalAssetProcessingJob.findMany.mockResolvedValue([]);
    prismaMock.digitalAsset.findMany.mockResolvedValue([]);
  });

  it("enqueues idempotent processing jobs per version", async () => {
    await digitalAssetProcessingService.enqueueAllJobs("asset-1", "org-1", 2);
    expect(prismaMock.digitalAssetProcessingJob.upsert).toHaveBeenCalledTimes(5);
    expect(prismaMock.digitalAssetProcessingJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assetId_idempotencyKey: { assetId: "asset-1", idempotencyKey: "CHECKSUM:v2" } },
      }),
    );
  });

  it("processes no jobs when queue is empty", async () => {
    const result = await digitalAssetProcessingService.processDueJobs();
    expect(result.processed).toBe(0);
  });

  it("skips already-claimed jobs (idempotent claim)", async () => {
    prismaMock.digitalAssetProcessingJob.findMany.mockResolvedValue([
      {
        id: "job-1",
        assetId: "asset-1",
        organisationId: "org-1",
        jobType: "PREVIEW",
        attemptCount: 0,
        maxAttempts: 3,
        scheduledFor: new Date(),
        asset: {
          id: "asset-1",
          organisationId: "org-1",
          brandId: "brand-1",
          storageKey: "key",
          mimeType: "image/png",
          checksum: "abc",
          width: 1,
          height: 1,
          durationSeconds: null,
          type: "IMAGE",
          createdByUserId: "user-1",
        },
      },
    ]);
    prismaMock.digitalAssetProcessingJob.updateMany.mockResolvedValue({ count: 0 });

    const result = await digitalAssetProcessingService.processDueJobs();
    expect(result.processed).toBe(0);
  });
});
