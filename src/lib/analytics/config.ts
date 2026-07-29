const number = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
};

export type AnalyticsSyncConfig = {
  schedulerEnabled: boolean;
  intervalMinutes: number;
  leaseSeconds: number;
  retryBackoffSeconds: number;
  backfillDays: number;
  maxDiscoveryPagesPerRun: number;
  maxAccountsPerSchedulerRun: number;
  maxSyncsPerWorkerRun: number;
};

/**
 * Read at call time rather than module load so operators can change cadence without a rebuild and
 * so tests can exercise different windows.
 */
export function getAnalyticsSyncConfig(): AnalyticsSyncConfig {
  return {
    schedulerEnabled: (process.env.SOCIAL_ANALYTICS_SYNC_ENABLED ?? "true").toLowerCase() !== "false",
    intervalMinutes: number(process.env.SOCIAL_ANALYTICS_SYNC_INTERVAL_MINUTES, 360, 15, 10_080),
    leaseSeconds: number(process.env.SOCIAL_ANALYTICS_SYNC_LEASE_SECONDS, 300, 30, 3_600),
    retryBackoffSeconds: number(process.env.SOCIAL_ANALYTICS_SYNC_RETRY_SECONDS, 60, 5, 3_600),
    backfillDays: number(process.env.SOCIAL_ANALYTICS_BACKFILL_DAYS, 90, 1, 730),
    maxDiscoveryPagesPerRun: number(process.env.SOCIAL_ANALYTICS_BACKFILL_MAX_PAGES, 20, 1, 200),
    maxAccountsPerSchedulerRun: number(process.env.SOCIAL_ANALYTICS_SCHEDULER_BATCH, 100, 1, 1_000),
    maxSyncsPerWorkerRun: number(process.env.SOCIAL_ANALYTICS_WORKER_BATCH, 10, 1, 50),
  };
}

/**
 * Scheduled syncs are bucketed to a fixed window so repeated scheduler runs inside the same window
 * collapse onto one idempotency key instead of queueing duplicate work.
 */
export function scheduleWindowStart(now: Date, intervalMinutes: number): Date {
  const windowMs = intervalMinutes * 60_000;
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export function scheduledSyncIdempotencyKey(socialAccountId: string, windowStart: Date): string {
  return `scheduled:${socialAccountId}:${windowStart.toISOString()}`;
}
