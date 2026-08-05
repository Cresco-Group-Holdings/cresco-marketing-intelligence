import { beforeEach, describe, expect, it, vi } from "vitest";

const operationsTestIds = {
  organisationId: "org-1",
  projectId: "project-1",
  brandId: "brand-1",
  userId: "user-1",
  campaignId: "campaign-1",
  taskId: "task-1",
};

const tenantContext = {
  organisationId: operationsTestIds.organisationId,
  userId: operationsTestIds.userId,
  userProfileId: operationsTestIds.userId,
  organisationRole: "ADMIN" as const,
};

const prismaMock = vi.hoisted(() => ({
  organisationMembership: { findFirst: vi.fn() },
  contentCampaign: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  contentCampaignMember: { createMany: vi.fn() },
  contentTask: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  contentChecklist: { create: vi.fn() },
  contentDeadline: {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  contentAssignment: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  contentChecklistItem: { findFirst: vi.fn(), update: vi.fn() },
  contentActivity: { create: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({
      id: "brand-1",
      projectId: "project-1",
    }),
  },
}));
vi.mock("@/server/services/audit-service", () => ({
  recordAuditEvent: vi.fn(),
}));

import { contentOperationsService } from "@/server/services/content-operations-service";

describe("contentOperationsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.organisationMembership.findFirst.mockResolvedValue({ id: "membership-1" });
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
    prismaMock.contentDeadline.findMany.mockResolvedValue([]);
    prismaMock.contentActivity.findMany.mockResolvedValue([]);
    prismaMock.contentAssignment.findMany.mockResolvedValue([]);
    prismaMock.contentCampaign.count.mockResolvedValue(1);
    prismaMock.contentTask.count.mockResolvedValue(2);
    prismaMock.contentDeadline.count.mockResolvedValue(1);
  });

  it("rejects assignments for removed organisation members", async () => {
    prismaMock.organisationMembership.findFirst.mockResolvedValue(null);

    await expect(
      contentOperationsService.assignRole(
        operationsTestIds.brandId,
        operationsTestIds.organisationId,
        {
          userId: "removed-user",
          role: "CONTENT_OWNER",
          contentItemId: "content-1",
        },
        tenantContext,
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("creates tasks with default production checklist", async () => {
    prismaMock.contentTask.create.mockResolvedValue({
      id: operationsTestIds.taskId,
      title: "Write caption",
      campaignId: null,
      contentItemId: null,
    });
    prismaMock.contentChecklist.create.mockResolvedValue({
      id: "checklist-1",
      items: [{ id: "item-1", itemKey: "caption_complete" }],
    });

    const result = await contentOperationsService.createTask(
      operationsTestIds.brandId,
      operationsTestIds.organisationId,
      { title: "Write caption" },
      tenantContext,
    );

    expect(result.task.id).toBe(operationsTestIds.taskId);
    expect(prismaMock.contentChecklist.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Production checklist",
          items: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({ itemKey: "caption_complete" }),
            ]),
          }),
        }),
      }),
    );
  });

  it("records assignment changes in activity history", async () => {
    prismaMock.contentAssignment.findFirst.mockResolvedValue(null);
    prismaMock.contentAssignment.create.mockResolvedValue({
      id: "assignment-1",
      role: "COPY_REVIEWER",
      user: { id: "user-2", displayName: "Sam", email: "sam@example.com" },
    });

    await contentOperationsService.assignRole(
      operationsTestIds.brandId,
      operationsTestIds.organisationId,
      {
        userId: "user-2",
        role: "COPY_REVIEWER",
        taskId: operationsTestIds.taskId,
      },
      tenantContext,
    );

    expect(prismaMock.contentActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          activityType: "ASSIGNMENT_CHANGED",
          taskId: operationsTestIds.taskId,
        }),
      }),
    );
  });

  it("lists overdue tasks when requested", async () => {
    prismaMock.contentTask.findMany.mockResolvedValue([
      {
        id: "task-overdue",
        title: "Late review",
        description: null,
        status: "IN_PROGRESS",
        priority: "NORMAL",
        dueAt: new Date("2026-07-01T00:00:00.000Z"),
        assignee: null,
        owner: { id: "user-1", displayName: "Owner", email: "owner@example.com" },
        campaign: null,
        contentItem: null,
        deadlines: [],
      },
    ]);

    const tasks = await contentOperationsService.listTasks(
      operationsTestIds.brandId,
      operationsTestIds.organisationId,
      { overdueOnly: true },
      tenantContext,
    );

    expect(tasks[0]?.isOverdue).toBe(true);
    expect(prismaMock.contentTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      }),
    );
  });
});
