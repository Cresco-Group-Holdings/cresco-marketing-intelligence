import { prisma } from "@/lib/database/prisma";
import { automationExecutionJobIdempotencyKey } from "@/lib/workers/idempotency";
import type { DueWorkItem } from "@/lib/workers/types";

export async function discoverAutomationDueWork(now: Date, limit: number): Promise<DueWorkItem[]> {
  const executions = await prisma.automationExecution.findMany({
    where: {
      status: "PENDING",
      organisation: { status: "ACTIVE", archivedAt: null },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      organisationId: true,
      createdAt: true,
    },
  });

  return executions.map((execution) => ({
    organisationId: execution.organisationId,
    jobType: "AUTOMATION_EXECUTION",
    domainRefType: "automationExecution",
    domainRefId: execution.id,
    idempotencyKey: automationExecutionJobIdempotencyKey(execution.id),
    dueAt: execution.createdAt,
    payload: { executionId: execution.id },
  }));
}
