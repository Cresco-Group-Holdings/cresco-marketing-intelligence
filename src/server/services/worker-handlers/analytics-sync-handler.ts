import { prisma } from "@/lib/database/prisma";
import { socialAnalyticsSyncService } from "@/server/services/social-analytics-sync-service";
import type { WorkerHandler } from "@/lib/workers/types";

export const analyticsSyncWorkerHandler: WorkerHandler = async (input, context) => {
  const sync = await prisma.socialAnalyticsSync.findFirst({
    where: { id: input.domainRefId, organisationId: input.organisationId },
    select: { id: true },
  });
  if (!sync) {
    return { outcome: "failed", errorCategory: "NON_RETRYABLE", safeMessage: "Analytics sync tenant mismatch." };
  }

  const result = await socialAnalyticsSyncService.process(sync.id, context.workerId);
  if (!result) {
    return { outcome: "skipped", reason: "Analytics sync not claimable." };
  }

  if (result.status === "COMPLETED") {
    return { outcome: "success" };
  }

  if (result.status === "REQUEUED_AFTER_REFRESH") {
    return {
      outcome: "retry",
      errorCategory: "RETRYABLE",
      safeMessage: "Analytics sync requeued after token refresh.",
    };
  }

  if (result.status === "FAILED") {
    return {
      outcome: "retry",
      errorCategory: "RETRYABLE",
      safeMessage: "Analytics sync failed.",
    };
  }

  return { outcome: "success" };
};
