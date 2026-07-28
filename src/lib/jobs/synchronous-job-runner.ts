import { randomUUID } from "node:crypto";
import type { EnqueueJobInput, JobHandler, JobProvider, JobRecord } from "@/lib/jobs/types";
import { processNextJob } from "@/lib/jobs/types";

/**
 * Safe synchronous runner for local development and unit tests.
 * Not suitable for production — jobs execute inline in the current process.
 */
export class SynchronousJobRunner implements JobProvider {
  private readonly jobs = new Map<string, JobRecord>();

  async enqueue(input: EnqueueJobInput): Promise<JobRecord> {
    const job: JobRecord = {
      id: randomUUID(),
      type: input.type,
      status: "PENDING",
      payload: input.payload,
      attempts: 0,
      scheduledFor: input.scheduledFor ?? new Date(),
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async claimNext(type?: string): Promise<JobRecord | null> {
    const job = [...this.jobs.values()].find(
      (entry) =>
        entry.status === "PENDING" &&
        entry.scheduledFor <= new Date() &&
        (!type || entry.type === type),
    );
    if (!job) {
      return null;
    }

    const claimed: JobRecord = {
      ...job,
      status: "RUNNING",
      attempts: job.attempts + 1,
      startedAt: new Date(),
    };
    this.jobs.set(job.id, claimed);
    return claimed;
  }

  async complete(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    this.jobs.set(jobId, { ...job, status: "COMPLETED", completedAt: new Date() });
  }

  async fail(jobId: string, errorMessage: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    this.jobs.set(jobId, {
      ...job,
      status: "FAILED",
      completedAt: new Date(),
      errorMessage,
    });
  }

  async cancel(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    this.jobs.set(jobId, { ...job, status: "CANCELLED", completedAt: new Date() });
  }

  async runNext(handler: JobHandler, type?: string): Promise<JobRecord | null> {
    return processNextJob(this, handler, type);
  }

  resetForTests(): void {
    this.jobs.clear();
  }
}

export const synchronousJobRunner = new SynchronousJobRunner();
