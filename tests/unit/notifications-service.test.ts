import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";
import { CRITICAL_NOTIFICATION_CATEGORIES } from "@/lib/notifications/constants";

const prismaMock = vi.hoisted(() => ({
  notification: {
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  notificationDelivery: {
    create: vi.fn(),
  },
  notificationPreference: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  organisation: {
    findUnique: vi.fn(),
  },
  userProfile: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/notifications/email-provider", () => ({
  getEmailProvider: () => ({
    send: vi.fn().mockResolvedValue({ status: "SENT", externalId: "email-1" }),
  }),
}));

import { notificationPreferenceService, notificationService } from "@/server/services/notification-service";

describe("notification permissions", () => {
  it("allows viewers to read notifications but not recover operations", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["notifications.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["operations.recover"])).toBe(false);
  });

  it("allows admins to recover operations", () => {
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["operations.recover"])).toBe(true);
  });
});

describe("notification preferences", () => {
  const tenant = {
    organisationId: "org-1",
    userProfileId: "user-1",
    userId: "user-1",
    organisationRole: OrganisationRole.ADMIN,
  };

  beforeEach(() => {
    prismaMock.notificationPreference.findFirst.mockReset();
    prismaMock.notificationPreference.create.mockReset();
    prismaMock.notificationPreference.findFirst.mockResolvedValue(null);
    prismaMock.notificationPreference.create.mockResolvedValue({
      id: "pref-1",
      category: "SECURITY",
      enabled: true,
      isCriticalLocked: true,
    });
  });

  it("keeps security notifications enabled even when disabled is requested", async () => {
    await notificationPreferenceService.upsert(
      "org-1",
      "user-1",
      {
        category: "SECURITY",
        channel: "EMAIL",
        enabled: false,
      },
      tenant,
    );

    expect(prismaMock.notificationPreference.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ enabled: true, isCriticalLocked: true }),
      }),
    );
    expect(CRITICAL_NOTIFICATION_CATEGORIES).toContain("SECURITY");
  });
});

describe("notification deduplication", () => {
  beforeEach(() => {
    prismaMock.notification.findUnique.mockReset();
    prismaMock.notification.create.mockReset();
    prismaMock.notificationPreference.findFirst.mockReset();
    prismaMock.notification.findUnique.mockResolvedValue({
      id: "existing",
      userId: "user-1",
    });
    prismaMock.notificationPreference.findFirst.mockResolvedValue(null);
  });

  it("prevents duplicate notifications for the same idempotency key", async () => {
    const result = await notificationService.emit({
      organisationId: "org-1",
      eventType: "publishing.failed",
      title: "Publishing failed",
      body: "Provider rejected the media.",
      recipientUserIds: ["user-1"],
      idempotencyKey: "publish:job-1",
    });

    expect(result).toEqual([{ notification: { id: "existing", userId: "user-1" }, duplicate: true }]);
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });
});

describe("cross-tenant access", () => {
  it("rejects organisation scope mismatches", async () => {
    await expect(
      notificationService.unreadCount(
        "org-other",
        "user-1",
        {
          organisationId: "org-1",
          userProfileId: "user-1",
          userId: "user-1",
          organisationRole: OrganisationRole.ADMIN,
        },
      ),
    ).rejects.toThrow();
  });
});
