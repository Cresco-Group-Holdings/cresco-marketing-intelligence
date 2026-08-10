/**
 * Vercel Cron configuration.
 *
 * Vercel Hobby allows at most one invocation per cron job per day. High-frequency schedules
 * (for example every 5 minutes) must use Vercel Pro cron entries, GitHub Actions, or an
 * external worker hitting the individual process-due endpoints with PUBLISHING_WORKER_TOKEN.
 */

export const VERCEL_CRON_PATHS = {
  dailyDispatcher: "/api/cron/daily",
  publishingScheduler: "/api/publishing-scheduler/process-due",
  digitalAssetProcessing: "/api/digital-assets/process-due",
  socialAnalyticsScheduler: "/api/social-analytics-sync/schedule",
} as const;

/** Hobby-compatible: once per day at 06:00 UTC. */
export const VERCEL_HOBBY_DAILY_CRON_SCHEDULE = "0 6 * * *";

/** Example Pro / external high-frequency publishing schedule (not valid on Hobby). */
export const VERCEL_PRO_PUBLISHING_CRON_SCHEDULE = "*/5 * * * *";

export type DailyCronJobId =
  | "publishing_scheduler"
  | "digital_asset_processing"
  | "social_analytics_scheduler"
  | "seo_crawl"
  | "notification_digest_daily"
  | "social_reports";

export type DailyCronJobDefinition = {
  id: DailyCronJobId;
  description: string;
  enabled: (env?: CronEnv) => boolean;
};

type CronEnv = Record<string, string | undefined>;

const truthy = (value: string | undefined) => (value ?? "true").toLowerCase() !== "false";

export function getDailyCronJobDefinitions(env: CronEnv = process.env): DailyCronJobDefinition[] {
  return [
    {
      id: "publishing_scheduler",
      description: "Enqueue due content schedules and drain publishing jobs.",
      enabled: (runtime = env) => truthy(runtime.PUBLISHING_SCHEDULER_ENABLED),
    },
    {
      id: "digital_asset_processing",
      description: "Process pending digital asset checksum, metadata, thumbnail, and safety jobs.",
      enabled: (runtime = env) => truthy(runtime.DIGITAL_ASSET_PROCESSING_ENABLED),
    },
    {
      id: "social_analytics_scheduler",
      description: "Enqueue recurring social analytics syncs and drain due sync work.",
      enabled: (runtime = env) => truthy(runtime.SOCIAL_ANALYTICS_SYNC_ENABLED),
    },
    {
      id: "seo_crawl",
      description: "Drain due SEO crawl queue items.",
      enabled: (runtime = env) => truthy(runtime.SEO_CRAWL_SCHEDULER_ENABLED),
    },
    {
      id: "notification_digest_daily",
      description: "Send due daily notification digests.",
      enabled: (runtime = env) => truthy(runtime.NOTIFICATION_DIGEST_SCHEDULER_ENABLED),
    },
    {
      id: "social_reports",
      description: "Process due scheduled social report deliveries.",
      enabled: (runtime = env) => truthy(runtime.SOCIAL_REPORTS_SCHEDULER_ENABLED),
    },
  ];
}

/**
 * Returns false on preview/development unless VERCEL_CRON_ENABLED=true so preview deploys
 * do not accidentally run maintenance work.
 */
export function isVercelCronDispatchEnabled(env: CronEnv = process.env): boolean {
  if ((env.VERCEL_CRON_ENABLED ?? "").toLowerCase() === "false") {
    return false;
  }

  if (env.VERCEL_ENV === "production") {
    return true;
  }

  return (env.VERCEL_CRON_ENABLED ?? "").toLowerCase() === "true";
}

function fieldHasWildcardOrStep(field: string): boolean {
  return /[*\/,]/.test(field);
}

/**
 * Hobby plan requires each cron expression to fire at most once per calendar day.
 * Minute and hour must be fixed scalars; day/month/week wildcards are allowed for daily runs.
 */
export function isHobbyCompatibleCronSchedule(schedule: string): boolean {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) {
    return false;
  }

  const [minute, hour] = parts;
  if (fieldHasWildcardOrStep(minute) || fieldHasWildcardOrStep(hour)) {
    return false;
  }

  const minuteValue = Number(minute);
  const hourValue = Number(hour);
  if (!Number.isInteger(minuteValue) || minuteValue < 0 || minuteValue > 59) {
    return false;
  }
  if (!Number.isInteger(hourValue) || hourValue < 0 || hourValue > 23) {
    return false;
  }

  return true;
}

export function readDailyCronMaxPasses(env: CronEnv = process.env): number {
  const parsed = Number(env.DAILY_CRON_MAX_PASSES ?? 20);
  if (!Number.isFinite(parsed)) {
    return 20;
  }
  return Math.min(Math.max(Math.trunc(parsed), 1), 200);
}
