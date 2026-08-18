import type { WorkerJobType } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { isProductionRuntime } from "@/lib/providers/oauth/runtime";
import type { WorkerHandler } from "@/lib/workers/types";
import { analyticsSyncWorkerHandler } from "@/server/services/worker-handlers/analytics-sync-handler";
import { automationExecutionWorkerHandler } from "@/server/services/worker-handlers/automation-execution-handler";
import { damProcessingWorkerHandler } from "@/server/services/worker-handlers/dam-processing-handler";
import { notificationDigestWorkerHandler } from "@/server/services/worker-handlers/notification-digest-handler";
import { providerSyncWorkerHandler } from "@/server/services/worker-handlers/provider-sync-handler";
import { publishingWorkerHandler } from "@/server/services/worker-handlers/publishing-handler";
import { seoCrawlWorkerHandler } from "@/server/services/worker-handlers/seo-crawl-handler";
import { tokenRefreshWorkerHandler } from "@/server/services/worker-handlers/token-refresh-handler";

const HANDLERS: Record<WorkerJobType, WorkerHandler> = {
  PUBLISHING: publishingWorkerHandler,
  TOKEN_REFRESH: tokenRefreshWorkerHandler,
  ANALYTICS_SYNC: analyticsSyncWorkerHandler,
  PROVIDER_SYNC: providerSyncWorkerHandler,
  DAM_PROCESSING: damProcessingWorkerHandler,
  SEO_CRAWL: seoCrawlWorkerHandler,
  AUTOMATION_EXECUTION: automationExecutionWorkerHandler,
  NOTIFICATION_DIGEST: notificationDigestWorkerHandler,
};

export function resolveWorkerHandler(jobType: WorkerJobType): WorkerHandler {
  const handler = HANDLERS[jobType];
  if (!handler) {
    if (isProductionRuntime()) {
      throw new AppError("INTERNAL_ERROR", `No production handler registered for job type ${jobType}.`);
    }
    throw new AppError("VALIDATION_ERROR", `Unknown job type ${jobType}.`);
  }
  return handler;
}

export function listRegisteredWorkerJobTypes(): WorkerJobType[] {
  return Object.keys(HANDLERS) as WorkerJobType[];
}
