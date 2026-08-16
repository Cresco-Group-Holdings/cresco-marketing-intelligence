import { logger } from "@/lib/logging";
import { getClock } from "@/lib/workers/clock";
import { getWorkerPlatformConfig } from "@/lib/workers/config";
import type { ProcessSummary } from "@/lib/workers/types";
import {
  incrementWorkerCounter,
  recordWorkerExecutionDuration,
  recordWorkerFailure,
  recordWorkerQueueAge,
} from "@/lib/workers/observability";
import { resolveWorkerHandler } from "@/server/services/worker-handler-registry";
import { workerJobService } from "@/server/services/worker-job-service";

function emptySummary(startedAt: number): ProcessSummary {
  return {
    claimed: 0,
    succeeded: 0,
    failed: 0,
    retrying: 0,
    skipped: 0,
    deadLettered: 0,
    durationMs: Date.now() - startedAt,
  };
}

export const workerExecutorService = {
  async processAvailableJobs(input?: {
    workerId?: string;
    limit?: number;
    now?: Date;
    deadlineMs?: number;
  }): Promise<ProcessSummary> {
    const startedAt = Date.now();
    const now = input?.now ?? getClock().now();
    const config = getWorkerPlatformConfig();
    const workerId = input?.workerId ?? `worker-${startedAt}`;
    const deadlineMs = input?.deadlineMs ?? startedAt + config.executionBudgetMs;
    const limit = input?.limit ?? config.maxJobsPerInvocation;

    await workerJobService.recoverExpiredJobs(now);

    const jobs = await workerJobService.claimDueJobs({ limit, workerId, now });
    const summary = emptySummary(startedAt);
    summary.claimed = jobs.length;

    for (const job of jobs) {
      if (Date.now() >= deadlineMs) {
        logger.info("worker.execution_budget_exceeded", { workerId, jobId: job.id });
        break;
      }

      if (job.createdAt) {
        recordWorkerQueueAge(job.jobType, now.getTime() - job.createdAt.getTime(), {
          organisationId: job.organisationId,
        });
      }

      const jobStartedAt = Date.now();
      const heartbeat = async () => {
        await workerJobService.renewLease(job.id, workerId);
      };

      try {
        const handler = resolveWorkerHandler(job.jobType);
        const payload = workerJobService.getPayload(job);
        const result = await handler(
          {
            jobId: job.id,
            organisationId: job.organisationId,
            domainRefType: job.domainRefType,
            domainRefId: job.domainRefId,
            payload,
            attemptCount: job.attemptCount,
          },
          { workerId, now, heartbeat },
        );

        if (result.outcome === "success") {
          await workerJobService.completeJob(job.id, workerId);
          summary.succeeded += 1;
          incrementWorkerCounter("worker.jobs_succeeded", 1, { jobType: job.jobType });
        } else if (result.outcome === "skipped") {
          await workerJobService.completeJob(job.id, workerId);
          summary.skipped += 1;
        } else if (result.outcome === "retry") {
          const updated = await workerJobService.scheduleRetry(job.id, workerId, {
            errorCategory: result.errorCategory,
            safeMessage: result.safeMessage,
            retryAfterMs: result.retryAfterMs,
          });
          if (updated.status === "DEAD_LETTER") {
            summary.deadLettered += 1;
            incrementWorkerCounter("worker.jobs_dead_lettered", 1, { jobType: job.jobType });
          } else {
            summary.retrying += 1;
            incrementWorkerCounter("worker.jobs_retrying", 1, { jobType: job.jobType });
          }
          recordWorkerFailure(job.jobType, result.errorCategory, {
            organisationId: job.organisationId,
            attempt: job.attemptCount,
          });
        } else {
          const updated = await workerJobService.failJob(job.id, workerId, {
            errorCategory: result.errorCategory,
            safeMessage: result.safeMessage,
          });
          if (updated.status === "DEAD_LETTER") {
            summary.deadLettered += 1;
            incrementWorkerCounter("worker.jobs_dead_lettered", 1, { jobType: job.jobType });
          } else {
            summary.failed += 1;
            incrementWorkerCounter("worker.jobs_failed", 1, { jobType: job.jobType });
          }
          recordWorkerFailure(job.jobType, result.errorCategory, {
            organisationId: job.organisationId,
            attempt: job.attemptCount,
          });
        }
      } catch (error) {
        const safeMessage = error instanceof Error ? error.message.slice(0, 500) : "Worker execution failed.";
        const updated = await workerJobService.scheduleRetry(job.id, workerId, {
          errorCategory: "RETRYABLE",
          safeMessage,
        });
        if (updated.status === "DEAD_LETTER") {
          summary.deadLettered += 1;
        } else {
          summary.retrying += 1;
        }
        logger.error("worker.handler_error", {
          jobId: job.id,
          jobType: job.jobType,
          message: safeMessage,
        });
      }

      recordWorkerExecutionDuration(job.jobType, Date.now() - jobStartedAt, {
        organisationId: job.organisationId,
        attempt: job.attemptCount,
      });
    }

    summary.durationMs = Date.now() - startedAt;
    logger.info("worker.process_completed", { workerId, ...summary });
    return summary;
  },
};
