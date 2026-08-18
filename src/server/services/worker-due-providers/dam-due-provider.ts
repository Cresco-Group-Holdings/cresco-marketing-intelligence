import { DigitalAssetProcessingJobStatus } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { damProcessingJobIdempotencyKey } from "@/lib/workers/idempotency";
import type { DueWorkItem } from "@/lib/workers/types";

export async function discoverDamDueWork(now: Date, limit: number): Promise<DueWorkItem[]> {
  const jobs = await prisma.digitalAssetProcessingJob.findMany({
    where: {
      status: DigitalAssetProcessingJobStatus.PENDING,
      scheduledFor: { lte: now },
      organisation: { status: "ACTIVE", archivedAt: null },
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
    select: {
      id: true,
      organisationId: true,
      assetId: true,
      jobType: true,
      idempotencyKey: true,
      scheduledFor: true,
    },
  });

  return jobs.map((job) => ({
    organisationId: job.organisationId,
    jobType: "DAM_PROCESSING",
    domainRefType: "digitalAssetProcessingJob",
    domainRefId: job.id,
    idempotencyKey: damProcessingJobIdempotencyKey(job.assetId, job.jobType, 1),
    dueAt: job.scheduledFor,
    payload: { processingJobId: job.id, assetId: job.assetId, jobType: job.jobType },
  }));
}
