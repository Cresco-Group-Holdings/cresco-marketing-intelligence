import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const taskIds = vi.hoisted(() => ({
  organisationId: "org-task-test",
  projectId: "project-task-test",
  brandId: "brand-task-test",
  userProfileId: "user-task-test",
  taskId: "task-test-1",
  approvalId: "approval-test-1",
}));

const tenantContext = {
  userId: "auth-user-task-test",
  userProfileId: taskIds.userProfileId,
  organisationId: taskIds.organisationId,
  organisationRole: "OWNER" as const,
  projectId: taskIds.projectId,
  brandId: taskIds.brandId,
};

const prismaMock = vi.hoisted(() => ({
  marketingTask: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  marketingTaskDependency: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
  marketingTaskChecklistItem: {
    createMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  marketingTaskComment: { create: vi.fn() },
  marketingTaskAttachment: { create: vi.fn() },
  marketingTaskWatcher: { createMany: vi.fn() },
  marketingTaskActivity: { create: vi.fn() },
  marketingApprovalRequest: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  marketingApprovalDecision: { create: vi.fn() },
  organisationMembership: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({
      id: taskIds.brandId,
      projectId: taskIds.projectId,
    }),
  },
}));
vi.mock("@/server/services/audit-service", () => ({
  recordAuditEvent: vi.fn(),
}));

import { marketingTaskService } from "@/server/services/marketing-task-service";
import { marketingApprovalService } from "@/server/services/marketing-approval-service";

function mockTask(overrides: Record<string, unknown> = {}) {
  return {
    id: taskIds.taskId,
    organisationId: taskIds.organisationId,
    projectId: taskIds.projectId,
    brandId: taskIds.brandId,
    campaignId: null,
    title: "Review blog post",
    description: null,
    type: "CONTENT",
    status: "TODO",
    priority: "MEDIUM",
    version: 1,
    assigneeUserId: null,
    reporterUserId: taskIds.userProfileId,
    startAt: null,
    dueAt: null,
    completedAt: null,
    sourceEntityType: "contentItem",
    sourceEntityId: "content-1",
    templateId: null,
    isTemplate: false,
    recurrenceRule: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    assignee: null,
    reporter: { id: taskIds.userProfileId, displayName: "Reporter", email: "r@test.com" },
    campaign: null,
    dependencies: [],
    checklistItems: [],
    comments: [],
    attachments: [],
    watchers: [],
    activities: [],
    ...overrides,
  };
}

describe("task permissions", () => {
  it("allows marketers to create tasks via operations.write", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["operations.write"])).toBe(true);
  });

  it("restricts approval decisions to admins", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["approvals.decide"])).toBe(false);
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["approvals.decide"])).toBe(true);
  });
});

describe("marketingTaskService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.organisationMembership.findFirst.mockResolvedValue({ id: "member-1" });
    prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock);
      }
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg;
    });
    prismaMock.marketingTaskDependency.findMany.mockResolvedValue([]);
  });

  it("lists tasks scoped to organisation and brand", async () => {
    prismaMock.marketingTask.findMany.mockResolvedValue([mockTask()]);

    const items = await marketingTaskService.list(
      taskIds.brandId,
      taskIds.organisationId,
      tenantContext,
    );

    expect(items).toHaveLength(1);
    expect(prismaMock.marketingTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: taskIds.organisationId,
          brandId: taskIds.brandId,
        }),
      }),
    );
  });

  it("rejects version conflicts", async () => {
    prismaMock.marketingTask.findFirst.mockResolvedValue(mockTask({ version: 2 }));

    await expect(
      marketingTaskService.update(
        taskIds.brandId,
        taskIds.organisationId,
        taskIds.taskId,
        { title: "Updated", expectedVersion: 1 },
        tenantContext,
      ),
    ).rejects.toThrow(/version conflict/i);
  });

  it("rejects dependency cycles", async () => {
    prismaMock.marketingTask.findFirst.mockResolvedValue(mockTask());
    prismaMock.marketingTaskDependency.findMany.mockResolvedValue([
      { taskId: "task-b", dependsOnTaskId: taskIds.taskId },
    ]);

    await expect(
      marketingTaskService.addDependency(
        taskIds.brandId,
        taskIds.organisationId,
        taskIds.taskId,
        "task-b",
        tenantContext,
      ),
    ).rejects.toThrow(/cycle/i);
  });

  it("completes task and sets completedAt", async () => {
    prismaMock.marketingTask.findFirst.mockResolvedValue(mockTask());
    prismaMock.marketingTask.update.mockResolvedValue({});

    await marketingTaskService.complete(
      taskIds.brandId,
      taskIds.organisationId,
      taskIds.taskId,
      tenantContext,
    );

    expect(prismaMock.marketingTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DONE" }),
      }),
    );
  });

  it("returns not found for wrong tenant", async () => {
    prismaMock.marketingTask.findFirst.mockResolvedValue(null);

    await expect(
      marketingTaskService.getById(
        taskIds.brandId,
        taskIds.organisationId,
        "missing",
        tenantContext,
      ),
    ).rejects.toThrow(/not found/i);
  });

  it("lists tasks by entity reference", async () => {
    prismaMock.marketingTask.findMany.mockResolvedValue([mockTask()]);

    const items = await marketingTaskService.listByEntity(
      taskIds.brandId,
      taskIds.organisationId,
      "contentItem",
      "content-1",
      tenantContext,
    );

    expect(items).toHaveLength(1);
  });
});

describe("marketingApprovalService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg;
    });
  });

  it("creates pending approval requests", async () => {
    prismaMock.marketingApprovalRequest.create.mockResolvedValue({
      id: taskIds.approvalId,
      status: "PENDING",
    });
    prismaMock.marketingApprovalRequest.findFirst.mockResolvedValue({
      id: taskIds.approvalId,
      organisationId: taskIds.organisationId,
      brandId: taskIds.brandId,
      type: "CONTENT",
      status: "PENDING",
      title: "Approve content",
      description: null,
      entityType: "contentItem",
      entityId: "content-1",
      version: 1,
      requesterUserId: taskIds.userProfileId,
      requester: { id: taskIds.userProfileId, displayName: "User", email: "u@test.com" },
      createdAt: new Date(),
      updatedAt: new Date(),
      decisions: [],
    });

    const approval = await marketingApprovalService.create(
      taskIds.brandId,
      taskIds.organisationId,
      {
        type: "CONTENT",
        title: "Approve content",
        entityType: "contentItem",
        entityId: "content-1",
      },
      tenantContext,
    );

    expect(approval.status).toBe("PENDING");
  });

  it("prevents self-approval", async () => {
    prismaMock.marketingApprovalRequest.findFirst.mockResolvedValue({
      id: taskIds.approvalId,
      organisationId: taskIds.organisationId,
      brandId: taskIds.brandId,
      status: "PENDING",
      requesterUserId: taskIds.userProfileId,
      requester: { id: taskIds.userProfileId, displayName: "User", email: "u@test.com" },
      decisions: [],
      type: "CONTENT",
      title: "Test",
      description: null,
      entityType: "contentItem",
      entityId: "c-1",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      marketingApprovalService.decide(
        taskIds.brandId,
        taskIds.organisationId,
        taskIds.approvalId,
        { decision: "APPROVED" },
        tenantContext,
      ),
    ).rejects.toThrow(/cannot decide on their own/i);
  });

  it("creates immutable decision records", async () => {
    const pendingApproval = {
      id: taskIds.approvalId,
      organisationId: taskIds.organisationId,
      brandId: taskIds.brandId,
      status: "PENDING" as const,
      requesterUserId: "other-user",
      requester: { id: "other-user", displayName: "Other", email: "o@test.com" },
      decisions: [],
      type: "CONTENT" as const,
      title: "Test",
      description: null,
      entityType: "contentItem",
      entityId: "c-1",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const approvedApproval = {
      ...pendingApproval,
      status: "APPROVED" as const,
      decisions: [
        {
          id: "decision-1",
          decision: "APPROVED" as const,
          feedback: null,
          deciderUserId: taskIds.userProfileId,
          decider: { id: taskIds.userProfileId, displayName: "Decider", email: "d@test.com" },
          decidedAt: new Date(),
          createdAt: new Date(),
        },
      ],
    };

    prismaMock.marketingApprovalRequest.findFirst
      .mockResolvedValueOnce(pendingApproval)
      .mockResolvedValueOnce(approvedApproval);

    prismaMock.marketingApprovalDecision.create.mockResolvedValue({});
    prismaMock.marketingApprovalRequest.update.mockResolvedValue({});

    const result = await marketingApprovalService.decide(
      taskIds.brandId,
      taskIds.organisationId,
      taskIds.approvalId,
      { decision: "APPROVED" },
      tenantContext,
    );

    expect(prismaMock.marketingApprovalDecision.create).toHaveBeenCalled();
    expect(prismaMock.marketingApprovalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "APPROVED" } }),
    );
    expect(result.status).toBe("APPROVED");
  });
});
