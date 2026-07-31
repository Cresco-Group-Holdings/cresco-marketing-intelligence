const number = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
};

export type InboxSyncConfig = {
  schedulerEnabled: boolean;
  intervalMinutes: number;
  retryBackoffSeconds: number;
  maxPagesPerRun: number;
  maxSyncsPerWorkerRun: number;
};

export function getInboxSyncConfig(): InboxSyncConfig {
  return {
    schedulerEnabled: (process.env.SOCIAL_INBOX_SYNC_ENABLED ?? "true").toLowerCase() !== "false",
    intervalMinutes: number(process.env.SOCIAL_INBOX_SYNC_INTERVAL_MINUTES, 15, 5, 1_440),
    retryBackoffSeconds: number(process.env.SOCIAL_INBOX_SYNC_RETRY_SECONDS, 60, 5, 3_600),
    maxPagesPerRun: number(process.env.SOCIAL_INBOX_SYNC_MAX_PAGES, 10, 1, 100),
    maxSyncsPerWorkerRun: number(process.env.SOCIAL_INBOX_WORKER_BATCH, 10, 1, 50),
  };
}

export function scheduledInboxSyncIdempotencyKey(socialAccountId: string, windowStart: Date): string {
  return `scheduled-inbox:${socialAccountId}:${windowStart.toISOString()}`;
}
