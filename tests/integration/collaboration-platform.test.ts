import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  inboxItem: {
    findUnique: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  notification: { updateMany: vi.fn() },
  organisationMembership: { findFirst: vi.fn() },
  collaborationComment: { create: vi.fn() },
  userMention: { create: vi.fn() },
  commentThread: { findFirst: vi.fn() },
};

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/server/services/notification-service", () => ({
  notificationService: { emit: vi.fn().mockResolvedValue([{ notification: { id: "n1" }, duplicate: false }]) },
}));

vi.mock("@/server/services/workspace-service", () => ({
  brandService: { getById: vi.fn() },
}));

describe("unified inbox integration", () => {
  const tenant = {
    userId: "user-1",
    userProfileId: "user-1",
    organisationId: "org-1",
    organisationRole: "ADMIN" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deduplicates inbox items by idempotency key", async () => {
    const { unifiedInboxService } = await import("@/server/services/unified-inbox-service");

    prismaMock.inboxItem.findUnique.mockResolvedValue({
      id: "inbox-1",
      userId: "user-1",
      idempotencyKey: "key-1",
    });

    const result = await unifiedInboxService.upsertFromNotification({
      organisationId: "org-1",
      userId: "user-1",
      category: "APPROVAL",
      eventType: "content.approved",
      title: "Approved",
      message: "Content approved",
      idempotencyKey: "key-1",
    });

    expect(result.id).toBe("inbox-1");
    expect(prismaMock.inboxItem.create).not.toHaveBeenCalled();
  });

  it("prevents cross-tenant mention creation", async () => {
    const { commentThreadService } = await import("@/server/services/comment-thread-service");

    prismaMock.commentThread.findFirst.mockResolvedValue({
      id: "thread-1",
      organisationId: "org-1",
      resourceType: "content",
      resourceId: "content-1",
      projectId: "p1",
      brandId: "b1",
    });
    prismaMock.collaborationComment.create.mockResolvedValue({ id: "comment-1" });
    prismaMock.organisationMembership.findFirst.mockResolvedValue(null);

    await commentThreadService.addComment("org-1", "thread-1", "Hi @outsideruserid1234567890", tenant);

    expect(prismaMock.userMention.create).not.toHaveBeenCalled();
  });

  it("marks all inbox items read in bulk", async () => {
    const { unifiedInboxService } = await import("@/server/services/unified-inbox-service");

    prismaMock.inboxItem.updateMany.mockResolvedValue({ count: 5 });

    const result = await unifiedInboxService.markAllRead("org-1", "user-1", tenant);
    expect(result.updated).toBe(5);
  });
});
