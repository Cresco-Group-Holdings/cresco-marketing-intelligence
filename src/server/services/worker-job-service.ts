import type { Prisma, WorkerJob, WorkerJobErrorCategory, WorkerJobStatus } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { getClock } from "@/lib/workers/clock";
import { getWorkerPlatformConfig } from "@/lib/workers/config";
import {
  assertWorkerJobTransition,
  canTransitionWorkerJob,
  isExecutableWorkerStatus,
} from "@/lib/workers/lifecycle";
import { nextRetryAt } from "@/lib/workers/backoff";
import type { DueWorkItem } from "@/lib/workers/types";
import { incrementWorkerCounter } from "@/lib/workers/observability";

function asPayload(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export const workerJobService = {
  async createOrGet(input: DueWorkItem): Promise<{ job: WorkerJob; created: boolean }> {
    const config = getWorkerPlatformConfig();
    const existing = await prisma.workerJob.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return { job: existing, created: false };
    }

    const now = getClock().now();
    const dueAt = input.dueAt ?? now;
    const status: WorkerJobStatus =
      dueAt.getTime() > now.getTime() ? "SCHEDULED" : input.scheduledAt ? "SCHEDULED" : "READY";

    try {
      const job = await prisma.workerJob.create({
        data: {
          organisationId: input.organisationId,
          jobType: input.jobType,
          domainRefType: input.domainRefType,
          domainRefId: input.domainRefId,
          payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
          status,
          priority: input.priority ?? 0,
          dueAt,
          scheduledAt: input.scheduledAt,
          maxAttempts: input.maxAttempts ?? config.defaultMaxAttempts,
          idempotencyKey: input.idempotencyKey,
        },
      });
      incrementWorkerCounter("worker.jobs_queued", 1, { jobType: input.jobType });
      return { job, created: true };
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unique constraint")) {
        const job = await prisma.workerJob.findUniqueOrThrow({
          where: { idempotencyKey: input.idempotencyKey },
        });
        return { job, created: false };
      }
      throw error;
    }
  },

  async activateDueScheduledJobs(now: Date): Promise<number> {
    const result = await prisma.workerJob.updateMany({
      where: {
        status: { in: ["PENDING", "SCHEDULED"] },
        OR: [{ dueAt: null }, { dueAt: { lte: now } }],
        AND: [{ OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }] }],
      },
      data: { status: "READY" },
    });
    return result.count;
  },

  async activateRetryReadyJobs(now: Date): Promise<number> {
    const result = await prisma.workerJob.updateMany({
      where: {
        status: "RETRY_WAIT",
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      data: { status: "READY", nextRetryAt: null },
    });
    return result.count;
  },

  /**
   * Atomically claims due jobs using SKIP LOCKED so concurrent workers cannot claim the same row.
   */
  async claimDueJobs(input: { limit: number; workerId: string; now?: Date }): Promise<WorkerJob[]> {
    const now = input.now ?? getClock().now();
    const config = getWorkerPlatformConfig();
    const leaseUntil = new Date(now.getTime() + config.leaseDurationMs);
    const limit = Math.max(1, Math.min(input.limit, config.maxJobsPerInvocation));

    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "WorkerJob"
      WHERE status IN ('READY', 'RETRY_WAIT')
        AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= ${now})
        AND ("dueAt" IS NULL OR "dueAt" <= ${now})
      ORDER BY priority DESC, "dueAt" ASC NULLS LAST, "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;

    const claimed: WorkerJob[] = [];
    for (const row of rows) {
      const updated = await prisma.workerJob.updateMany({
        where: {
          id: row.id,
          status: { in: ["READY", "RETRY_WAIT"] },
        },
        data: {
          status: "RUNNING",
          claimedBy: input.workerId,
          leaseExpiresAt: leaseUntil,
          heartbeatAt: now,
          startedAt: now,
          attemptCount: { increment: 1 },
        },
      });

      if (updated.count === 1) {
        const job = await prisma.workerJob.findUniqueOrThrow({ where: { id: row.id } });
        incrementWorkerCounter("worker.jobs_claimed", 1, { jobType: job.jobType });
        claimed.push(job);
      }
    }

    return claimed;
  },

  async renewLease(jobId: string, workerId: string): Promise<boolean> {
    const now = getClock().now();
    const config = getWorkerPlatformConfig();
    const leaseUntil = new Date(now.getTime() + config.leaseDurationMs);
    const result = await prisma.workerJob.updateMany({
      where: { id: jobId, claimedBy: workerId, status: "RUNNING" },
      data: { heartbeatAt: now, leaseExpiresAt: leaseUntil },
    });
    return result.count === 1;
  },

  async completeJob(jobId: string, workerId: string): Promise<WorkerJob> {
    const job = await prisma.workerJob.findUnique({ where: { id: jobId } });
    if (!job) throw new AppError("NOT_FOUND", "Worker job not found.");
    if (job.claimedBy !== workerId) {
      throw new AppError("FORBIDDEN", "Worker job lease mismatch.");
    }
    assertWorkerJobTransition(job.status, "SUCCEEDED");

    return prisma.workerJob.update({
      where: { id: jobId },
      data: {
        status: "SUCCEEDED",
        completedAt: getClock().now(),
        leaseExpiresAt: null,
        claimedBy: null,
        safeErrorMessage: null,
        errorCategory: null,
      },
    });
  },

  async scheduleRetry(
    jobId: string,
    workerId: string,
    input: { errorCategory: WorkerJobErrorCategory; safeMessage: string; retryAfterMs?: number },
  ): Promise<WorkerJob> {
    const job = await prisma.workerJob.findUnique({ where: { id: jobId } });
    if (!job) throw new AppError("NOT_FOUND", "Worker job not found.");
    if (job.claimedBy !== workerId) {
      throw new AppError("FORBIDDEN", "Worker job lease mismatch.");
    }

    const now = getClock().now();
    if (job.attemptCount >= job.maxAttempts) {
      return this.deadLetter(jobId, workerId, input);
    }

    const retryTime = nextRetryAt(job.attemptCount, now, { retryAfterMs: input.retryAfterMs });
    return prisma.workerJob.update({
      where: { id: jobId },
      data: {
        status: "RETRY_WAIT",
        nextRetryAt: retryTime,
        errorCategory: input.errorCategory,
        safeErrorMessage: input.safeMessage.slice(0, 500),
        leaseExpiresAt: null,
        claimedBy: null,
      },
    });
  },

  async failJob(
    jobId: string,
    workerId: string,
    input: { errorCategory: WorkerJobErrorCategory; safeMessage: string },
  ): Promise<WorkerJob> {
    const job = await prisma.workerJob.findUnique({ where: { id: jobId } });
    if (!job) throw new AppError("NOT_FOUND", "Worker job not found.");
    if (job.claimedBy !== workerId) {
      throw new AppError("FORBIDDEN", "Worker job lease mismatch.");
    }

    const now = getClock().now();
    if (job.attemptCount >= job.maxAttempts) {
      return this.deadLetter(jobId, workerId, input);
    }

    return prisma.workerJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        failedAt: now,
        errorCategory: input.errorCategory,
        safeErrorMessage: input.safeMessage.slice(0, 500),
        leaseExpiresAt: null,
        claimedBy: null,
      },
    });
  },

  async deadLetter(
    jobId: string,
    workerId: string,
    input: { errorCategory: WorkerJobErrorCategory; safeMessage: string },
  ): Promise<WorkerJob> {
    const job = await prisma.workerJob.findUnique({ where: { id: jobId } });
    if (!job) throw new AppError("NOT_FOUND", "Worker job not found.");
    if (job.claimedBy && job.claimedBy !== workerId) {
      throw new AppError("FORBIDDEN", "Worker job lease mismatch.");
    }

    const now = getClock().now();
    return prisma.workerJob.update({
      where: { id: jobId },
      data: {
        status: "DEAD_LETTER",
        failedAt: now,
        errorCategory: input.errorCategory,
        safeErrorMessage: input.safeMessage.slice(0, 500),
        leaseExpiresAt: null,
        claimedBy: null,
      },
    });
  },

  async cancelJob(jobId: string, organisationId: string): Promise<WorkerJob | null> {
    const job = await prisma.workerJob.findFirst({
      where: { id: jobId, organisationId },
    });
    if (!job) return null;
    if (!canTransitionWorkerJob(job.status, "CANCELLED")) {
      throw new AppError("VALIDATION_ERROR", `Cannot cancel job in status ${job.status}.`);
    }
    return prisma.workerJob.update({
      where: { id: jobId },
      data: { status: "CANCELLED", completedAt: getClock().now() },
    });
  },

  async recoverExpiredJobs(now = getClock().now()): Promise<number> {
    const expired = await prisma.workerJob.findMany({
      where: {
        status: "RUNNING",
        leaseExpiresAt: { lt: now },
      },
      take: 100,
      select: { id: true, attemptCount: true, maxAttempts: true },
    });

    let recovered = 0;
    for (const job of expired) {
      if (job.attemptCount >= job.maxAttempts) {
        await prisma.workerJob.update({
          where: { id: job.id },
          data: {
            status: "DEAD_LETTER",
            failedAt: now,
            safeErrorMessage: "Job lease expired and retry budget exhausted.",
            errorCategory: "RETRYABLE",
            claimedBy: null,
            leaseExpiresAt: null,
          },
        });
      } else {
        await prisma.workerJob.update({
          where: { id: job.id },
          data: {
            status: "RETRY_WAIT",
            nextRetryAt: nextRetryAt(job.attemptCount, now),
            claimedBy: null,
            leaseExpiresAt: null,
            safeErrorMessage: "Recovered after worker lease expiry.",
            errorCategory: "RETRYABLE",
          },
        });
      }
      incrementWorkerCounter("worker.lease_recoveries", 1);
      recovered += 1;
    }
    return recovered;
  },

  getPayload(job: WorkerJob): Record<string, unknown> | null {
    return asPayload(job.payload);
  },

  isExecutable(job: WorkerJob, now = getClock().now()): boolean {
    if (!isExecutableWorkerStatus(job.status) && job.status !== "RUNNING") return false;
    if (job.nextRetryAt && job.nextRetryAt.getTime() > now.getTime()) return false;
    if (job.dueAt && job.dueAt.getTime() > now.getTime()) return false;
    return true;
  },
};
