import { prisma } from "@/lib/database/prisma";
import type { WorkerHandler } from "@/lib/workers/types";

export const automationExecutionWorkerHandler: WorkerHandler = async (input) => {
  const execution = await prisma.automationExecution.findFirst({
    where: { id: input.domainRefId, organisationId: input.organisationId },
    select: { id: true, status: true },
  });
  if (!execution) {
    return { outcome: "failed", errorCategory: "NON_RETRYABLE", safeMessage: "Automation execution tenant mismatch." };
  }

  if (execution.status !== "PENDING") {
    return { outcome: "skipped", reason: `Execution status is ${execution.status}.` };
  }

  return {
    outcome: "skipped",
    reason: "Async automation execution resume is not yet wired; execution remains pending.",
  };
};
