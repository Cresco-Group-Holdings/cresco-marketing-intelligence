import { prisma } from "@/lib/database/prisma";
import { automationEngineExecutionService } from "@/server/services/automation-engine-execution-service";
import type { WorkerHandler } from "@/lib/workers/types";

export const automationExecutionWorkerHandler: WorkerHandler = async (input) => {
  const execution = await prisma.automationExecution.findFirst({
    where: { id: input.domainRefId, organisationId: input.organisationId },
    select: { id: true, status: true },
  });
  if (!execution) {
    return {
      outcome: "failed",
      errorCategory: "NON_RETRYABLE",
      safeMessage: "Automation execution tenant mismatch.",
    };
  }

  if (execution.status !== "PENDING" && execution.status !== "FAILED") {
    return { outcome: "skipped", reason: `Execution status is ${execution.status}.` };
  }

  try {
    const result = await automationEngineExecutionService.resumePendingExecution(
      execution.id,
      input.organisationId,
    );
    if (result.skipped) {
      return { outcome: "skipped", reason: `Execution status is ${result.status}.` };
    }
    if (result.status === "FAILED") {
      return {
        outcome: "retry",
        errorCategory: "RETRYABLE",
        safeMessage: result.errorMessage ?? "Automation execution failed.",
      };
    }
    if (result.status === "DEAD_LETTER") {
      return {
        outcome: "failed",
        errorCategory: "NON_RETRYABLE",
        safeMessage: result.errorMessage ?? "Automation execution dead-lettered.",
      };
    }
    return { outcome: "success" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automation execution failed.";
    return {
      outcome: "retry",
      errorCategory: "RETRYABLE",
      safeMessage: message,
    };
  }
};
