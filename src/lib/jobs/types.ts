export type JobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type JobPayload = Record<string, unknown>;

export type JobRecord = {
  id: string;
  type: string;
  status: JobStatus;
  payload: JobPayload;
  attempts: number;
  scheduledFor: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
};

export type EnqueueJobInput = {
  type: string;
  payload: JobPayload;
  scheduledFor?: Date;
  idempotencyKey?: string;
};

export interface JobProvider {
  enqueue(input: EnqueueJobInput): Promise<JobRecord>;
  claimNext(type?: string): Promise<JobRecord | null>;
  complete(jobId: string): Promise<void>;
  fail(jobId: string, errorMessage: string): Promise<void>;
  cancel(jobId: string): Promise<void>;
}

export type JobHandler = (job: JobRecord) => Promise<void>;

export async function processNextJob(
  provider: JobProvider,
  handler: JobHandler,
  type?: string,
): Promise<JobRecord | null> {
  const job = await provider.claimNext(type);
  if (!job) {
    return null;
  }

  try {
    await handler(job);
    await provider.complete(job.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job failed.";
    await provider.fail(job.id, message);
    throw error;
  }

  return job;
}
