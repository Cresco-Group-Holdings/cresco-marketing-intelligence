import { prisma } from "@/lib/database/prisma";
import { providerSyncEngineService } from "@/server/services/provider-sync-engine-service";
import { buildWorkerTenantContext } from "@/lib/workers/tenant-context";
import type { WorkerHandler } from "@/lib/workers/types";

export const providerSyncWorkerHandler: WorkerHandler = async (input) => {
  const syncRun = await prisma.providerSyncRun.findFirst({
    where: { id: input.domainRefId, organisationId: input.organisationId },
    select: { id: true, requestedByUserId: true },
  });
  if (!syncRun) {
    return { outcome: "failed", errorCategory: "NON_RETRYABLE", safeMessage: "Provider sync tenant mismatch." };
  }

  const context = await buildWorkerTenantContext(input.organisationId, syncRun.requestedByUserId);
  const result = await providerSyncEngineService.executeSyncRun(
    syncRun.id,
    input.organisationId,
    context,
  );

  if (result.status === "SUCCEEDED" || result.status === "COMPLETED" || result.status === "PARTIALLY_SUCCEEDED") {
    return { outcome: "success" };
  }

  if (result.status === "RETRYING") {
    return {
      outcome: "retry",
      errorCategory: "RETRYABLE",
      safeMessage: result.errorMessage ?? "Provider sync retry scheduled.",
    };
  }

  if (result.status === "DEAD_LETTERED" || result.status === "FAILED") {
    return {
      outcome: "failed",
      errorCategory: "NON_RETRYABLE",
      safeMessage: result.errorMessage ?? "Provider sync failed.",
    };
  }

  return { outcome: "success" };
};
