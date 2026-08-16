import type { WorkerJobErrorCategory, WorkerJobStatus, WorkerJobType } from "@prisma/client";

export type WorkerJobPayload = Record<string, unknown>;

export type WorkerHandlerContext = {
  workerId: string;
  now: Date;
  heartbeat: () => Promise<void>;
};

export type WorkerHandlerResult =
  | { outcome: "success" }
  | {
      outcome: "retry";
      errorCategory: WorkerJobErrorCategory;
      safeMessage: string;
      retryAfterMs?: number;
    }
  | {
      outcome: "failed";
      errorCategory: WorkerJobErrorCategory;
      safeMessage: string;
    }
  | { outcome: "skipped"; reason: string };

export type WorkerHandler = (
  input: {
    jobId: string;
    organisationId: string;
    domainRefType: string;
    domainRefId: string;
    payload: WorkerJobPayload | null;
    attemptCount: number;
  },
  context: WorkerHandlerContext,
) => Promise<WorkerHandlerResult>;

export type DueWorkItem = {
  organisationId: string;
  jobType: WorkerJobType;
  domainRefType: string;
  domainRefId: string;
  idempotencyKey: string;
  dueAt?: Date;
  scheduledAt?: Date;
  priority?: number;
  payload?: WorkerJobPayload;
  maxAttempts?: number;
};

export type DispatchSummary = {
  discovered: number;
  created: number;
  activated: number;
  skipped: number;
  byType: Partial<Record<WorkerJobType, { created: number; skipped: number }>>;
};

export type ProcessSummary = {
  claimed: number;
  succeeded: number;
  failed: number;
  retrying: number;
  skipped: number;
  deadLettered: number;
  durationMs: number;
};

export const EXECUTABLE_STATUSES: WorkerJobStatus[] = ["READY", "RETRY_WAIT"];

export const TERMINAL_STATUSES: WorkerJobStatus[] = [
  "SUCCEEDED",
  "FAILED",
  "DEAD_LETTER",
  "CANCELLED",
];
