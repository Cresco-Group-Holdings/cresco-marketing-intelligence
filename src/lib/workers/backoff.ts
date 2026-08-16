import { getWorkerPlatformConfig } from "@/lib/workers/config";
import { getClock } from "@/lib/workers/clock";

export function calculateWorkerRetryDelay(
  attempt: number,
  options?: { retryAfterMs?: number; config?: ReturnType<typeof getWorkerPlatformConfig> },
): number {
  const config = options?.config ?? getWorkerPlatformConfig();
  if (options?.retryAfterMs && options.retryAfterMs > 0) {
    return Math.min(options.retryAfterMs, config.retryMaxDelayMs);
  }

  const exponential = Math.min(
    config.retryBaseDelayMs * 2 ** Math.max(attempt - 1, 0),
    config.retryMaxDelayMs,
  );
  const jitter = exponential * config.retryJitterFactor * getClock().random();
  return Math.floor(exponential + jitter);
}

export function nextRetryAt(
  attempt: number,
  from: Date,
  options?: { retryAfterMs?: number; config?: ReturnType<typeof getWorkerPlatformConfig> },
): Date {
  const delayMs = calculateWorkerRetryDelay(attempt, options);
  return new Date(from.getTime() + delayMs);
}
