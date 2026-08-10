import { randomUUID } from "node:crypto";
import { getAnalyticsSyncConfig } from "@/lib/analytics/config";
import { logger } from "@/lib/logging";
import { getPublishingConfig } from "@/lib/publishing/config";
import { getSeoCrawlConfig } from "@/lib/seo/config";
import {
  getDailyCronJobDefinitions,
  isVercelCronDispatchEnabled,
  readDailyCronMaxPasses,
  type DailyCronJobId,
} from "@/lib/scheduling/vercel-cron";
import { digitalAssetProcessingService } from "@/server/services/digital-asset-processing-service";
import { notificationDigestService } from "@/server/services/notification-service";
import { publishingSchedulerService } from "@/server/services/publishing-scheduler-service";
import { seoCrawlService } from "@/server/services/seo-crawl-service";
import { socialAnalyticsSchedulerService } from "@/server/services/social-analytics-scheduler-service";
import { socialReportService } from "@/server/services/social-report-service";

export type DailyCronDispatchSkipReason = "DISPATCH_DISABLED";

export type DailyCronDispatchOutcome = {
  skipped: boolean;
  skipReason?: DailyCronDispatchSkipReason;
  workerId: string;
  jobs: Partial<Record<DailyCronJobId, unknown>>;
};

async function drainDigitalAssetProcessing(maxPasses: number) {
  const passes = [];
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const result = await digitalAssetProcessingService.processDueJobs();
    passes.push(result);
    if (result.processed === 0) {
      break;
    }
  }
  return { passes, totalProcessed: passes.reduce((sum, pass) => sum + pass.processed, 0) };
}

async function drainPublishingScheduler(workerId: string) {
  const config = getPublishingConfig();
  const maxPasses = readDailyCronMaxPasses();
  const passes = [];

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const result = await publishingSchedulerService.runSchedulerPass({
      workerId,
      limit: config.maxJobsPerWorkerRun,
    });
    passes.push(result);
    if (result.processed.length === 0 && result.scheduled.enqueued.length === 0) {
      break;
    }
  }

  return { passes };
}

async function drainSocialAnalyticsScheduler(workerId: string) {
  const config = getAnalyticsSyncConfig();
  const maxPasses = readDailyCronMaxPasses();
  const passes = [];

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const result = await socialAnalyticsSchedulerService.runSchedulerPass({
      workerId,
      limit: config.maxSyncsPerWorkerRun,
    });
    passes.push(result);
    const processedCount = Array.isArray(result.processed) ? result.processed.length : 0;
    if (processedCount === 0 && result.scheduled.enqueued.length === 0) {
      break;
    }
  }

  return { passes };
}

async function drainSeoCrawl(workerId: string) {
  const config = getSeoCrawlConfig();
  const maxPasses = readDailyCronMaxPasses();
  const passes = [];

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const results = await seoCrawlService.processDue(config.maxCrawlsPerWorkerRun, workerId);
    passes.push({ processed: results.length, results });
    if (results.length === 0) {
      break;
    }
  }

  return { passes };
}

export const dailyCronDispatcherService = {
  async dispatch(input?: { workerId?: string }): Promise<DailyCronDispatchOutcome> {
    const workerId = input?.workerId ?? `daily-cron-${randomUUID()}`;
    const enabledJobs = getDailyCronJobDefinitions().filter((job) => job.enabled());

    if (!isVercelCronDispatchEnabled()) {
      logger.info("cron.daily_dispatch_skipped", {
        workerId,
        reason: "DISPATCH_DISABLED",
        vercelEnv: process.env.VERCEL_ENV ?? "local",
      });
      return {
        skipped: true,
        skipReason: "DISPATCH_DISABLED",
        workerId,
        jobs: {},
      };
    }

    const jobs: Partial<Record<DailyCronJobId, unknown>> = {};
    const maxPasses = readDailyCronMaxPasses();

    for (const job of enabledJobs) {
      switch (job.id) {
        case "publishing_scheduler":
          jobs.publishing_scheduler = await drainPublishingScheduler(workerId);
          break;
        case "digital_asset_processing":
          jobs.digital_asset_processing = await drainDigitalAssetProcessing(maxPasses);
          break;
        case "social_analytics_scheduler":
          jobs.social_analytics_scheduler = await drainSocialAnalyticsScheduler(workerId);
          break;
        case "seo_crawl":
          jobs.seo_crawl = await drainSeoCrawl(workerId);
          break;
        case "notification_digest_daily":
          jobs.notification_digest_daily = {
            digests: await notificationDigestService.processDue("DIGEST_DAILY"),
          };
          break;
        case "social_reports":
          jobs.social_reports = {
            results: await socialReportService.processDueSchedules(),
          };
          break;
        default:
          break;
      }
    }

    logger.info("cron.daily_dispatch_completed", {
      workerId,
      jobIds: Object.keys(jobs),
    });

    return { skipped: false, workerId, jobs };
  },
};
