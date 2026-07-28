import { randomUUID } from "node:crypto";
import type { EnqueueJobInput, JobProvider, JobRecord } from "@/lib/jobs/types";

/**
 * Database-backed job provider for production and integration tests.
 * Jobs are persisted and claimed atomically — not held in memory.
 */
export class DatabaseJobProvider implements JobProvider {
  constructor(
    private readonly store: {
      create(data: {
        id: string;
        type: string;
        status: JobRecord["status"];
        payload: JobRecord["payload"];
        attempts: number;
        scheduledFor: Date;
        idempotencyKey?: string;
      }): Promise<JobRecord>;
      findFirstClaimable(type?: string): Promise<JobRecord | null>;
      update(
        id: string,
        data: Partial<Pick<JobRecord, "status" | "attempts" | "startedAt" | "completedAt" | "errorMessage">>,
      ): Promise<JobRecord>;
      findByIdempotencyKey?(idempotencyKey: string): Promise<JobRecord | null>;
    },
  ) {}

  async enqueue(input: EnqueueJobInput): Promise<JobRecord> {
    if (input.idempotencyKey && this.store.findByIdempotencyKey) {
      const existing = await this.store.findByIdempotencyKey(input.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    return this.store.create({
      id: randomUUID(),
      type: input.type,
      status: "PENDING",
      payload: input.payload,
      attempts: 0,
      scheduledFor: input.scheduledFor ?? new Date(),
      idempotencyKey: input.idempotencyKey,
    });
  }

  async claimNext(type?: string): Promise<JobRecord | null> {
    const job = await this.store.findFirstClaimable(type);
    if (!job) {
      return null;
    }

    return this.store.update(job.id, {
      status: "RUNNING",
      attempts: job.attempts + 1,
      startedAt: new Date(),
    });
  }

  async complete(jobId: string): Promise<void> {
    await this.store.update(jobId, {
      status: "COMPLETED",
      completedAt: new Date(),
    });
  }

  async fail(jobId: string, errorMessage: string): Promise<void> {
    await this.store.update(jobId, {
      status: "FAILED",
      completedAt: new Date(),
      errorMessage,
    });
  }

  async cancel(jobId: string): Promise<void> {
    await this.store.update(jobId, {
      status: "CANCELLED",
      completedAt: new Date(),
    });
  }
}
