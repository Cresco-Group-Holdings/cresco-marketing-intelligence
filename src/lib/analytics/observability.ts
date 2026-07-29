import { logger } from "@/lib/logging";

export const ANALYTICS_COUNTERS = [
  "analytics.scheduled_jobs_enqueued",
  "analytics.scheduled_jobs_skipped",
  "analytics.stale_jobs_reclaimed",
  "analytics.refresh_attempts",
  "analytics.refresh_succeeded",
  "analytics.refresh_failed",
  "analytics.reconnect_required",
  "analytics.partial_syncs",
  "analytics.completed_syncs",
  "analytics.failed_syncs",
  "analytics.rate_limits",
  "analytics.unavailable_metrics",
  "analytics.terminal_provider_failures",
  "analytics.metrics_stored",
  "analytics.posts_processed",
  "analytics.backfill_pages",
] as const;

export type AnalyticsCounter = (typeof ANALYTICS_COUNTERS)[number];

const counters = new Map<AnalyticsCounter, number>();

/**
 * In-process counters back the operational log lines and let tests assert on emitted signals.
 * They are intentionally not a metrics backend: an external collector scrapes the structured logs.
 */
export function incrementAnalyticsCounter(
  counter: AnalyticsCounter,
  amount = 1,
  context?: Record<string, unknown>,
): number {
  const next = (counters.get(counter) ?? 0) + amount;
  counters.set(counter, next);
  logger.info(counter, { ...context, amount, total: next });
  return next;
}

export function readAnalyticsCounters(): Record<string, number> {
  return Object.fromEntries(counters);
}

export function resetAnalyticsCounters(): void {
  counters.clear();
}
