import {
  DigitalAssetProcessingJobStatus,
  DigitalAssetProcessingJobType,
  DigitalAssetStatus,
} from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { computeAssetChecksum } from "@/lib/digital-assets/checksum";
import { DIGITAL_ASSET_PROCESSING_BATCH_SIZE, DIGITAL_ASSET_PROCESSING_JOB_TYPES } from "@/lib/digital-assets/constants";
import {
  buildDigitalAssetThumbnailKey,
} from "@/lib/digital-assets/file-processing";
import { generateImageThumbnail } from "@/lib/digital-assets/thumbnail";
import { createObjectStorageProvider } from "@/lib/storage/supabase-storage-provider";
import { createMalwareScanner } from "@/lib/marketing-assets/malware-scanner";

const CRITICAL_JOB_TYPES: DigitalAssetProcessingJobType[] = ["CHECKSUM", "SAFETY_VALIDATION"];

function jobIdempotencyKey(jobType: DigitalAssetProcessingJobType, version: number): string {
  return `${jobType}:v${version}`;
}

export const digitalAssetProcessingService = {
  async enqueueAllJobs(assetId: string, organisationId: string, version: number): Promise<void> {
    for (const jobType of DIGITAL_ASSET_PROCESSING_JOB_TYPES) {
      await prisma.digitalAssetProcessingJob.upsert({
        where: {
          assetId_idempotencyKey: {
            assetId,
            idempotencyKey: jobIdempotencyKey(jobType, version),
          },
        },
        create: {
          organisationId,
          assetId,
          jobType,
          idempotencyKey: jobIdempotencyKey(jobType, version),
          status: DigitalAssetProcessingJobStatus.PENDING,
        },
        update: {},
      });
    }
  },

  async processDueJobs(now = new Date(), batchSize = DIGITAL_ASSET_PROCESSING_BATCH_SIZE) {
    const jobs = await prisma.digitalAssetProcessingJob.findMany({
      where: {
        status: DigitalAssetProcessingJobStatus.PENDING,
        scheduledFor: { lte: now },
      },
      orderBy: { scheduledFor: "asc" },
      take: batchSize,
      include: { asset: true },
    });

    const outcomes: Array<{ jobId: string; status: string }> = [];

    for (const job of jobs) {
      const claimed = await prisma.digitalAssetProcessingJob.updateMany({
        where: { id: job.id, status: DigitalAssetProcessingJobStatus.PENDING },
        data: {
          status: DigitalAssetProcessingJobStatus.RUNNING,
          startedAt: now,
          attemptCount: { increment: 1 },
        },
      });

      if (claimed.count === 0) {
        continue;
      }

      try {
        const result = await executeJob(job.jobType, job.asset);
        await prisma.digitalAssetProcessingJob.update({
          where: { id: job.id },
          data: {
            status: DigitalAssetProcessingJobStatus.COMPLETED,
            completedAt: new Date(),
            result: result as object,
            lastError: null,
          },
        });
        outcomes.push({ jobId: job.id, status: "COMPLETED" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Processing failed.";
        const failed = job.attemptCount + 1 >= job.maxAttempts;

        await prisma.digitalAssetProcessingJob.update({
          where: { id: job.id },
          data: {
            status: failed
              ? DigitalAssetProcessingJobStatus.FAILED
              : DigitalAssetProcessingJobStatus.PENDING,
            lastError: message,
            scheduledFor: failed ? job.scheduledFor : new Date(Date.now() + 30_000),
          },
        });

        if (failed && CRITICAL_JOB_TYPES.includes(job.jobType)) {
          await prisma.digitalAsset.update({
            where: { id: job.assetId },
            data: { status: DigitalAssetStatus.FAILED },
          });
          await prisma.digitalAssetActivity.create({
            data: {
              organisationId: job.organisationId,
              assetId: job.assetId,
              actorUserId: job.asset.createdByUserId,
              action: "PROCESSING_FAILED",
              metadata: { jobType: job.jobType, error: message },
            },
          });
        }

        outcomes.push({ jobId: job.id, status: failed ? "FAILED" : "RETRY" });
      }
    }

    await finalizeReadyAssets();

    return { processed: outcomes.length, outcomes };
  },
};

async function executeJob(
  jobType: DigitalAssetProcessingJobType,
  asset: {
    id: string;
    organisationId: string;
    brandId: string | null;
    storageKey: string;
    mimeType: string;
    checksum: string;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
    type: string;
  },
): Promise<Record<string, unknown>> {
  const storage = createObjectStorageProvider();

  switch (jobType) {
    case "CHECKSUM": {
      const signed = await storage.createSignedUrl(asset.storageKey, 60);
      const response = await fetch(signed.url);
      if (!response.ok) throw new Error("Unable to read asset for checksum verification.");
      const buffer = Buffer.from(await response.arrayBuffer());
      const checksum = computeAssetChecksum(buffer);
      if (checksum !== asset.checksum) {
        throw new Error("Checksum verification failed.");
      }
      return { verified: true, checksum };
    }

    case "SAFETY_VALIDATION": {
      const signed = await storage.createSignedUrl(asset.storageKey, 60);
      const response = await fetch(signed.url);
      if (!response.ok) throw new Error("Unable to read asset for safety validation.");
      const buffer = Buffer.from(await response.arrayBuffer());
      const scanner = createMalwareScanner();
      const result = await scanner.scan(buffer, asset.mimeType);
      if (!result.clean) {
        throw new Error(result.reason ?? "Safety validation failed.");
      }
      return { clean: true };
    }

    case "METADATA": {
      await prisma.digitalAssetMetadata.upsert({
        where: { assetId_metadataKey: { assetId: asset.id, metadataKey: "dimensions" } },
        create: {
          assetId: asset.id,
          organisationId: asset.organisationId,
          metadataKey: "dimensions",
          jsonValue: { width: asset.width, height: asset.height, durationSeconds: asset.durationSeconds },
        },
        update: {
          jsonValue: { width: asset.width, height: asset.height, durationSeconds: asset.durationSeconds },
        },
      });
      return { width: asset.width, height: asset.height };
    }

    case "THUMBNAIL": {
      if (!asset.mimeType.startsWith("image/")) {
        return { skipped: true, reason: "Not an image" };
      }
      const signed = await storage.createSignedUrl(asset.storageKey, 60);
      const response = await fetch(signed.url);
      if (!response.ok) throw new Error("Unable to read asset for thumbnail.");
      const buffer = Buffer.from(await response.arrayBuffer());
      const thumbnail = await generateImageThumbnail(buffer);
      if (!thumbnail) return { skipped: true, reason: "Thumbnail generation failed" };

      const thumbKey = buildDigitalAssetThumbnailKey(asset.organisationId, asset.brandId, asset.id);
      await storage.upload({ key: thumbKey, body: thumbnail, contentType: "image/webp" });
      await prisma.digitalAsset.update({
        where: { id: asset.id },
        data: { thumbnailStorageKey: thumbKey },
      });
      return { thumbnailStorageKey: thumbKey };
    }

    case "PREVIEW": {
      return { previewReady: asset.mimeType.startsWith("image/") || asset.mimeType === "application/pdf" };
    }

    default:
      return { skipped: true };
  }
}

async function finalizeReadyAssets(): Promise<void> {
  const processingAssets = await prisma.digitalAsset.findMany({
    where: { status: DigitalAssetStatus.PROCESSING },
    select: { id: true, organisationId: true, createdByUserId: true },
  });

  for (const asset of processingAssets) {
    const pendingCritical = await prisma.digitalAssetProcessingJob.count({
      where: {
        assetId: asset.id,
        jobType: { in: CRITICAL_JOB_TYPES },
        status: { in: [DigitalAssetProcessingJobStatus.PENDING, DigitalAssetProcessingJobStatus.RUNNING] },
      },
    });

    const failedCritical = await prisma.digitalAssetProcessingJob.count({
      where: {
        assetId: asset.id,
        jobType: { in: CRITICAL_JOB_TYPES },
        status: DigitalAssetProcessingJobStatus.FAILED,
      },
    });

    if (failedCritical > 0) continue;
    if (pendingCritical > 0) continue;

    await prisma.digitalAsset.update({
      where: { id: asset.id },
      data: { status: DigitalAssetStatus.READY },
    });

    await prisma.digitalAssetActivity.create({
      data: {
        organisationId: asset.organisationId,
        assetId: asset.id,
        actorUserId: asset.createdByUserId,
        action: "PROCESSING_COMPLETED",
      },
    });
  }
}
