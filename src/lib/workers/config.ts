export type WorkerPlatformConfig = {
  maxJobsPerInvocation: number;
  maxDispatchPerType: number;
  executionBudgetMs: number;
  leaseDurationMs: number;
  heartbeatIntervalMs: number;
  defaultMaxAttempts: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  retryJitterFactor: number;
  tokenRefreshWindowMs: number;
  tokenRefreshBatchLimit: number;
};

const number = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
};

export function getWorkerPlatformConfig(): WorkerPlatformConfig {
  return {
    maxJobsPerInvocation: number(process.env.WORKER_MAX_JOBS_PER_INVOCATION, 25, 1, 100),
    maxDispatchPerType: number(process.env.WORKER_MAX_DISPATCH_PER_TYPE, 50, 1, 200),
    executionBudgetMs: number(process.env.WORKER_EXECUTION_BUDGET_MS, 55_000, 5_000, 120_000),
    leaseDurationMs: number(process.env.WORKER_LEASE_DURATION_MS, 120_000, 30_000, 600_000),
    heartbeatIntervalMs: number(process.env.WORKER_HEARTBEAT_INTERVAL_MS, 30_000, 5_000, 120_000),
    defaultMaxAttempts: number(process.env.WORKER_DEFAULT_MAX_ATTEMPTS, 3, 1, 10),
    retryBaseDelayMs: number(process.env.WORKER_RETRY_BASE_DELAY_MS, 5_000, 1_000, 60_000),
    retryMaxDelayMs: number(process.env.WORKER_RETRY_MAX_DELAY_MS, 300_000, 10_000, 3_600_000),
    retryJitterFactor: Number(process.env.WORKER_RETRY_JITTER_FACTOR ?? 0.2),
    tokenRefreshWindowMs: number(process.env.WORKER_TOKEN_REFRESH_WINDOW_MS, 3_600_000, 60_000, 86_400_000),
    tokenRefreshBatchLimit: number(process.env.WORKER_TOKEN_REFRESH_BATCH_LIMIT, 25, 1, 100),
  };
}
