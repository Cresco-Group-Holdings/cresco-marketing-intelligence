import { logger } from "@/lib/logging";

export const PUBLISHING_COUNTERS = [
  "publishing.scheduled_jobs_enqueued",
  "publishing.scheduled_jobs_skipped",
  "publishing.provider_shutdown_skipped",
  "publishing.capability_blocked",
  "publishing.jobs_processed",
  "publishing.jobs_failed",
  "publishing.jobs_requeued",
  "publishing.manual_fallback_required",
  "publishing.completed_jobs",
  "publishing.duplicate_prevented",
] as const;

export type PublishingCounter = (typeof PUBLISHING_COUNTERS)[number];

const counters = new Map<PublishingCounter, number>();

/**
 * In-process counters back operational log lines and let tests assert on emitted signals.
 * External collectors should scrape the structured logs rather than this map.
 */
export function incrementPublishingCounter(
  counter: PublishingCounter,
  amount = 1,
  context?: Record<string, unknown>,
): number {
  const next = (counters.get(counter) ?? 0) + amount;
  counters.set(counter, next);
  logger.info(counter, { ...context, amount, total: next });
  return next;
}

export function readPublishingCounters(): Record<string, number> {
  return Object.fromEntries(counters);
}

export function resetPublishingCounters(): void {
  counters.clear();
}
