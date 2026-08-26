import { beforeEach, describe, expect, it, vi } from "vitest";

const resumePendingExecution = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/automation-engine-execution-service", () => ({
  automationEngineExecutionService: { resumePendingExecution },
}));

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    automationExecution: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/database/prisma";
import { automationExecutionWorkerHandler } from "@/server/services/worker-handlers/automation-execution-handler";

describe("automation execution worker handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects foreign tenant executions", async () => {
    vi.mocked(prisma.automationExecution.findFirst).mockResolvedValue(null);
    const result = await automationExecutionWorkerHandler(
      {
        jobId: "job-1",
        organisationId: "org-a",
        domainRefType: "automationExecution",
        domainRefId: "exec-1",
        payload: null,
        attemptCount: 0,
      },
      { workerId: "w1", now: new Date(), heartbeat: vi.fn() },
    );
    expect(result.outcome).toBe("failed");
  });

  it("resumes pending executions", async () => {
    vi.mocked(prisma.automationExecution.findFirst).mockResolvedValue({
      id: "exec-1",
      status: "PENDING",
    } as never);
    resumePendingExecution.mockResolvedValue({
      workflowId: "wf-1",
      executionId: "exec-1",
      status: "COMPLETED",
      skipped: false,
    });

    const result = await automationExecutionWorkerHandler(
      {
        jobId: "job-1",
        organisationId: "org-a",
        domainRefType: "automationExecution",
        domainRefId: "exec-1",
        payload: null,
        attemptCount: 0,
      },
      { workerId: "w1", now: new Date(), heartbeat: vi.fn() },
    );
    expect(result.outcome).toBe("success");
    expect(resumePendingExecution).toHaveBeenCalledWith("exec-1", "org-a");
  });
});
