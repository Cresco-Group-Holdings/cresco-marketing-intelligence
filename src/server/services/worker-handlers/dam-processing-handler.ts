import { DigitalAssetProcessingJobStatus } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { digitalAssetProcessingService } from "@/server/services/digital-asset-processing-service";
import type { WorkerHandler } from "@/lib/workers/types";

export const damProcessingWorkerHandler: WorkerHandler = async (input) => {
  const job = await prisma.digitalAssetProcessingJob.findFirst({
    where: { id: input.domainRefId, organisationId: input.organisationId },
    select: { id: true, status: true },
  });
  if (!job) {
    return { outcome: "failed", errorCategory: "NON_RETRYABLE", safeMessage: "DAM job tenant mismatch." };
  }

  if (job.status === DigitalAssetProcessingJobStatus.COMPLETED) {
    return { outcome: "skipped", reason: "DAM job already completed." };
  }

  const results = await digitalAssetProcessingService.processDueJobs(new Date(), 1);
  const processed = results.find((entry) => entry.jobId === job.id);
  if (!processed) {
    return { outcome: "skipped", reason: "DAM job not due." };
  }

  if (processed.status === "COMPLETED") {
    return { outcome: "success" };
  }

  return {
    outcome: "retry",
    errorCategory: "RETRYABLE",
    safeMessage: "DAM processing failed.",
  };
};
