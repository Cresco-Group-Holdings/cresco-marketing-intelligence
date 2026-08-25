import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  automationWorkflow: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  automationVersion: { create: vi.fn(), update: vi.fn() },
  automationTrigger: { create: vi.fn() },
  automationCondition: { create: vi.fn() },
  automationAction: { create: vi.fn() },
  automationExecution: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
  automationExecutionStep: { create: vi.fn(), update: vi.fn() },
  automationQuotaUsage: { upsert: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({ id: "brand-1", projectId: "project-1" }),
  },
}));
vi.mock("@/server/services/audit-service", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("@/server/services/crm-task-service", () => ({
  crmTaskService: { createTask: vi.fn().mockResolvedValue({ id: "task-1" }) },
}));
vi.mock("@/server/services/crm-service", () => ({
  crmService: { updateLeadStatus: vi.fn(), assignOwner: vi.fn() },
}));
vi.mock("@/server/services/crm-activity-service", () => ({
  crmActivityService: { logActivity: vi.fn().mockResolvedValue({ id: "activity-1" }) },
}));
vi.mock("@/server/services/notification-service", () => ({
  notificationService: { emit: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/server/services/entitlement-service", () => ({
  entitlementService: {
    assert: vi.fn().mockResolvedValue({ allowed: true }),
    check: vi.fn().mockResolvedValue({ allowed: true }),
  },
}));
vi.mock("@/server/services/usage-metering-service", () => ({
  usageMeteringService: {
    recordUsage: vi.fn().mockResolvedValue({ recorded: true }),
  },
}));

import { automationEngineService } from "@/server/services/automation-engine-service";
import { automationEngineExecutionService } from "@/server/services/automation-engine-execution-service";
import { OrganisationRole } from "@prisma/client";

const tenantContext = {
  userId: "user-1",
  userProfileId: "profile-1",
  organisationId: "org-1",
  organisationRole: OrganisationRole.OWNER,
};

describe("automationEngineService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
    prismaMock.automationWorkflow.findFirst.mockResolvedValue({
      id: "wf-1",
      organisationId: "org-1",
      brandId: "brand-1",
      projectId: "project-1",
      status: "DRAFT",
      activeVersionId: "ver-1",
      versions: [{ versionNumber: 1 }],
      activeVersion: {
        id: "ver-1",
        actions: [{ actionType: "CREATE_TASK", config: { title: "Test" } }],
        conditions: [{ field: "campaign.status", operator: "equals", value: "ACTIVE" }],
        triggers: [],
      },
    });
    prismaMock.automationVersion.create.mockResolvedValue({ id: "ver-2", versionNumber: 2 });
    prismaMock.automationWorkflow.update.mockResolvedValue({ id: "wf-1", status: "ACTIVE" });
    prismaMock.automationVersion.update.mockResolvedValue({ id: "ver-1", status: "ACTIVE" });
  });

  it("dry-runs version conditions without executing actions", async () => {
    const result = await automationEngineService.dryRunVersion(
      "wf-1",
      "brand-1",
      "org-1",
      { campaign: { status: "ACTIVE" } },
      tenantContext,
    );
    expect(result.conditionsPass).toBe(true);
    expect(result.plannedActions).toHaveLength(1);
  });

  it("rejects dry-run when conditions fail", async () => {
    const result = await automationEngineService.dryRunVersion(
      "wf-1",
      "brand-1",
      "org-1",
      { campaign: { status: "PLANNED" } },
      tenantContext,
    );
    expect(result.conditionsPass).toBe(false);
    expect(result.plannedActions).toHaveLength(0);
  });
});

describe("automationEngineExecutionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.automationWorkflow.findMany.mockResolvedValue([
      {
        id: "wf-1",
        preventSelfTrigger: true,
        executionLimitPerDay: 100,
        monthlyQuota: 1000,
        activeVersion: {
          id: "ver-1",
          triggers: [{ triggerKind: "EVENT", eventType: "CAMPAIGN_ACTIVATED", isEnabled: true }],
          conditions: [{ field: "campaign.status", operator: "equals", value: "ACTIVE" }],
          actions: [
            {
              id: "act-1",
              actionType: "CREATE_TASK",
              config: { title: "Launch task" },
              sortOrder: 0,
              maxRetries: 3,
            },
          ],
        },
      },
    ]);
    prismaMock.automationExecution.findUnique.mockResolvedValue(null);
    prismaMock.automationExecution.count.mockResolvedValue(0);
    prismaMock.automationQuotaUsage.upsert.mockResolvedValue({ id: "quota-1", executionCount: 0 });
    prismaMock.automationExecution.create.mockResolvedValue({
      id: "exec-1",
      attemptCount: 0,
      maxAttempts: 3,
    });
    prismaMock.automationExecutionStep.create.mockResolvedValue({ id: "step-1" });
    prismaMock.automationExecution.update.mockResolvedValue({ id: "exec-1", status: "COMPLETED" });
  });

  it("dispatches matching events and creates executions", async () => {
    const result = await automationEngineExecutionService.dispatchEvent(
      "brand-1",
      "org-1",
      {
        eventType: "CAMPAIGN_ACTIVATED",
        payload: { campaign: { status: "ACTIVE" }, resourceId: "camp-1" },
      },
      tenantContext,
    );
    expect(result.results).toHaveLength(1);
    expect(prismaMock.automationExecution.create).toHaveBeenCalled();
  });

  it("skips duplicate idempotency keys", async () => {
    prismaMock.automationExecution.findUnique.mockResolvedValue({ id: "existing" });
    const result = await automationEngineExecutionService.dispatchEvent(
      "brand-1",
      "org-1",
      {
        eventType: "CAMPAIGN_ACTIVATED",
        payload: { campaign: { status: "ACTIVE" }, resourceId: "camp-1" },
      },
      tenantContext,
    );
    expect(result.results[0].status).toBe("SKIPPED");
    expect(prismaMock.automationExecution.create).not.toHaveBeenCalled();
  });

  it("supports dry-run dispatch without quota increment", async () => {
    const result = await automationEngineExecutionService.dispatchEvent(
      "brand-1",
      "org-1",
      {
        eventType: "CAMPAIGN_ACTIVATED",
        payload: { campaign: { status: "ACTIVE" }, resourceId: "camp-1" },
        dryRun: true,
      },
      tenantContext,
    );
    expect(result.results[0].status).toBe("DRY_RUN");
    expect(prismaMock.automationQuotaUsage.update).not.toHaveBeenCalled();
  });
});
