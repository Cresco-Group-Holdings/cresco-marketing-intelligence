import { logger } from "@/lib/logging";
import type { WorkerJobErrorCategory, WorkerJobType } from "@prisma/client";

type CounterName =
  | "worker.jobs_queued"
  | "worker.jobs_claimed"
  | "worker.jobs_running"
  | "worker.jobs_succeeded"
  | "worker.jobs_failed"
  | "worker.jobs_retrying"
  | "worker.jobs_dead_lettered"
  | "worker.lease_recoveries"
  | "worker.dispatch_created"
  | "worker.dispatch_skipped";

const counters = new Map<string, number>();

export function incrementWorkerCounter(
  name: CounterName,
  amount = 1,
  dimensions?: Record<string, string | number | undefined>,
): void {
  const key = `${name}:${JSON.stringify(dimensions ?? {})}`;
  counters.set(key, (counters.get(key) ?? 0) + amount);
  logger.info(name, { amount, ...dimensions });
}

export function recordWorkerExecutionDuration(
  jobType: WorkerJobType,
  durationMs: number,
  dimensions?: { organisationId?: string; attempt?: number },
): void {
  logger.info("worker.execution_duration", { jobType, durationMs, ...dimensions });
}

export function recordWorkerQueueAge(
  jobType: WorkerJobType,
  ageMs: number,
  dimensions?: { organisationId?: string },
): void {
  logger.info("worker.queue_age", { jobType, ageMs, ...dimensions });
}

export function recordWorkerFailure(
  jobType: WorkerJobType,
  errorCategory: WorkerJobErrorCategory,
  dimensions?: { organisationId?: string; attempt?: number },
): void {
  logger.warn("worker.job_failed", { jobType, errorCategory, ...dimensions });
}

export function getWorkerCountersForTests(): Map<string, number> {
  return new Map(counters);
}

export function resetWorkerCountersForTests(): void {
  counters.clear();
}
