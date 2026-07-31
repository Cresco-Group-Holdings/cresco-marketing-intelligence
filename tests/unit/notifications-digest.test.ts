import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  notificationDelivery: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  notificationDigest: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));

import { notificationDigestService } from "@/server/services/notification-service";

describe("notification digest grouping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.notificationDelivery.findMany.mockResolvedValue([
      {
        id: "delivery-1",
        notification: { organisationId: "org-1", userId: "user-1" },
      },
      {
        id: "delivery-2",
        notification: { organisationId: "org-1", userId: "user-1" },
      },
      {
        id: "delivery-3",
        notification: { organisationId: "org-1", userId: "user-2" },
      },
    ]);
    prismaMock.notificationDigest.create.mockImplementation(async ({ data }) => ({
      id: `digest-${data.userId}`,
      ...data,
    }));
    prismaMock.notificationDelivery.updateMany.mockResolvedValue({ count: 1 });
  });

  it("groups pending deliveries by organisation and user", async () => {
    const digests = await notificationDigestService.processDue("DIGEST_DAILY");
    expect(digests).toHaveLength(2);
    expect(prismaMock.notificationDigest.create).toHaveBeenCalledTimes(2);
  });
});
