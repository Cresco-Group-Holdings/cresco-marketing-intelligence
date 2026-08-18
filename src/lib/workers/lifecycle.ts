import type { WorkerJobStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";

const TRANSITIONS: Record<WorkerJobStatus, WorkerJobStatus[]> = {
  PENDING: ["SCHEDULED", "READY", "CANCELLED"],
  SCHEDULED: ["READY", "CANCELLED"],
  READY: ["CLAIMED", "CANCELLED"],
  CLAIMED: ["RUNNING", "RETRY_WAIT", "FAILED", "DEAD_LETTER", "CANCELLED"],
  RUNNING: ["SUCCEEDED", "RETRY_WAIT", "FAILED", "DEAD_LETTER", "READY"],
  RETRY_WAIT: ["READY", "CANCELLED", "DEAD_LETTER"],
  SUCCEEDED: [],
  FAILED: ["DEAD_LETTER", "READY"],
  DEAD_LETTER: [],
  CANCELLED: [],
};

export function assertWorkerJobTransition(from: WorkerJobStatus, to: WorkerJobStatus): void {
  const allowed = TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Invalid worker job transition from ${from} to ${to}.`,
    );
  }
}

export function canTransitionWorkerJob(from: WorkerJobStatus, to: WorkerJobStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isExecutableWorkerStatus(status: WorkerJobStatus): boolean {
  return status === "READY" || status === "RETRY_WAIT";
}

export function isTerminalWorkerStatus(status: WorkerJobStatus): boolean {
  return status === "SUCCEEDED" || status === "FAILED" || status === "DEAD_LETTER" || status === "CANCELLED";
}
