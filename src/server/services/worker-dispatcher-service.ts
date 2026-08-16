import type { WorkerJobType } from "@prisma/client";
import { logger } from "@/lib/logging";
import { getClock } from "@/lib/workers/clock";
import { getWorkerPlatformConfig } from "@/lib/workers/config";
import type { DispatchSummary, DueWorkItem } from "@/lib/workers/types";
import { incrementWorkerCounter } from "@/lib/workers/observability";
import { workerJobService } from "@/server/services/worker-job-service";
import { discoverAnalyticsDueWork } from "@/server/services/worker-due-providers/analytics-due-provider";
import { discoverAutomationDueWork } from "@/server/services/worker-due-providers/automation-due-provider";
import { discoverDamDueWork } from "@/server/services/worker-due-providers/dam-due-provider";
import { discoverNotificationDueWork } from "@/server/services/worker-due-providers/notification-due-provider";
import { discoverProviderSyncDueWork } from "@/server/services/worker-due-providers/provider-sync-due-provider";
import { discoverPublishingDueWork } from "@/server/services/worker-due-providers/publishing-due-provider";
import { discoverSeoCrawlDueWork } from "@/server/services/worker-due-providers/seo-crawl-due-provider";
import { discoverTokenRefreshDueWork } from "@/server/services/worker-due-providers/token-refresh-due-provider";

type DueWorkProvider = (now: Date, limit: number) => Promise<DueWorkItem[]>;

const DUE_WORK_PROVIDERS: Partial<Record<WorkerJobType, DueWorkProvider>> = {
  PUBLISHING: discoverPublishingDueWork,
  TOKEN_REFRESH: discoverTokenRefreshDueWork,
  ANALYTICS_SYNC: discoverAnalyticsDueWork,
  PROVIDER_SYNC: discoverProviderSyncDueWork,
  DAM_PROCESSING: discoverDamDueWork,
  SEO_CRAWL: discoverSeoCrawlDueWork,
  AUTOMATION_EXECUTION: discoverAutomationDueWork,
  NOTIFICATION_DIGEST: discoverNotificationDueWork,
};

function emptySummary(): DispatchSummary {
  return { discovered: 0, created: 0, activated: 0, skipped: 0, byType: {} };
}

export const workerDispatcherService = {
  async dispatchDueJobs(input?: {
    now?: Date;
    limit?: number;
    jobTypes?: WorkerJobType[];
  }): Promise<DispatchSummary> {
    const now = input?.now ?? getClock().now();
    const config = getWorkerPlatformConfig();
    const perTypeLimit = input?.limit ?? config.maxDispatchPerType;
    const summary = emptySummary();

    const activatedScheduled = await workerJobService.activateDueScheduledJobs(now);
    const activatedRetry = await workerJobService.activateRetryReadyJobs(now);
    summary.activated = activatedScheduled + activatedRetry;

    const types = input?.jobTypes ?? (Object.keys(DUE_WORK_PROVIDERS) as WorkerJobType[]);

    for (const jobType of types) {
      const provider = DUE_WORK_PROVIDERS[jobType];
      if (!provider) continue;

      const items = await provider(now, perTypeLimit);
      summary.discovered += items.length;
      summary.byType[jobType] = { created: 0, skipped: 0 };

      for (const item of items) {
        const { created } = await workerJobService.createOrGet(item);
        if (created) {
          summary.created += 1;
          summary.byType[jobType]!.created += 1;
          incrementWorkerCounter("worker.dispatch_created", 1, { jobType });
        } else {
          summary.skipped += 1;
          summary.byType[jobType]!.skipped += 1;
          incrementWorkerCounter("worker.dispatch_skipped", 1, { jobType });
        }
      }
    }

    logger.info("worker.dispatch_completed", {
      now: now.toISOString(),
      ...summary,
    });

    return summary;
  },
};
