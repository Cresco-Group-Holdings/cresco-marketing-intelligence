import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  platformAdminGrant: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  securityAuditLog: { create: vi.fn() },
  supportAccessSession: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  dataRetentionPolicy: { upsert: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  auditLog: { deleteMany: vi.fn() },
  dataDeletionRequest: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  operationalAlert: { count: vi.fn(), findMany: vi.fn() },
  billingEvent: { count: vi.fn(), findMany: vi.fn() },
  organisation: { count: vi.fn(), findMany: vi.fn() },
  userProfile: { count: vi.fn() },
  publishingJob: { updateMany: vi.fn() },
}));

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    platformAdminGrant: prismaMock.platformAdminGrant,
    securityAuditLog: prismaMock.securityAuditLog,
    supportAccessSession: prismaMock.supportAccessSession,
    dataRetentionPolicy: prismaMock.dataRetentionPolicy,
    auditLog: prismaMock.auditLog,
    dataDeletionRequest: prismaMock.dataDeletionRequest,
    operationalAlert: prismaMock.operationalAlert,
    billingEvent: prismaMock.billingEvent,
    organisation: prismaMock.organisation,
    userProfile: prismaMock.userProfile,
    publishingJob: prismaMock.publishingJob,
  },
}));

vi.mock("@/lib/observability/health-checks", () => ({
  runReadinessChecks: vi.fn().mockResolvedValue({ ready: true, checks: [], timestamp: new Date().toISOString() }),
}));

vi.mock("@/server/providers/billing/stripe-billing-provider", () => ({
  isStripeBillingConfigured: vi.fn().mockReturnValue(false),
}));

import { platformAdminService } from "@/server/services/platform-admin-service";
import { supportAccessService } from "@/server/services/support-access-service";
import { retentionService } from "@/server/services/retention-service";
import { dataDeletionService } from "@/server/services/data-deletion-service";

describe("platform admin service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PLATFORM_ADMIN_EMAILS;
  });

  it("grants access via database grant", async () => {
    prismaMock.platformAdminGrant.findUnique.mockResolvedValue({ id: "grant-1" });
    const result = await platformAdminService.isPlatformAdmin("user-1");
    expect(result).toBe(true);
  });

  it("grants access via env allowlist", async () => {
    prismaMock.platformAdminGrant.findUnique.mockResolvedValue(null);
    process.env.PLATFORM_ADMIN_EMAILS = "admin@cresco.test";
    const result = await platformAdminService.isPlatformAdmin("user-1", "admin@cresco.test");
    expect(result).toBe(true);
  });

  it("denies non-admin users", async () => {
    prismaMock.platformAdminGrant.findUnique.mockResolvedValue(null);
    const result = await platformAdminService.isPlatformAdmin("user-1", "user@cresco.test");
    expect(result).toBe(false);
  });
});

describe("support access service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.supportAccessSession.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.securityAuditLog.create.mockResolvedValue({ id: "audit-1" });
  });

  it("requires a detailed reason", async () => {
    await expect(
      supportAccessService.startSession({
        adminUserId: "admin-1",
        targetUserId: "user-2",
        reason: "short",
      }),
    ).rejects.toThrow("detailed reason");
  });

  it("prevents self-impersonation", async () => {
    await expect(
      supportAccessService.startSession({
        adminUserId: "admin-1",
        targetUserId: "admin-1",
        reason: "Need to debug my own account settings",
      }),
    ).rejects.toThrow("Cannot impersonate yourself");
  });

  it("creates audited support session", async () => {
    prismaMock.supportAccessSession.create.mockResolvedValue({
      id: "session-1",
      targetUser: { email: "user@test.com" },
      targetOrg: null,
    });

    const session = await supportAccessService.startSession({
      adminUserId: "admin-1",
      targetUserId: "user-2",
      reason: "Customer reported billing issue on ticket #12345",
    });

    expect(session.id).toBe("session-1");
    expect(prismaMock.securityAuditLog.create).toHaveBeenCalled();
  });
});

describe("retention service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.dataRetentionPolicy.upsert.mockResolvedValue({});
    prismaMock.dataRetentionPolicy.findMany.mockResolvedValue([]);
    prismaMock.dataRetentionPolicy.findUnique.mockResolvedValue({ isActive: true, retentionDays: 365 });
    prismaMock.auditLog.deleteMany.mockResolvedValue({ count: 5 });
  });

  it("purges expired audit logs", async () => {
    const result = await retentionService.purgeExpiredAuditLogs();
    expect(result.purged).toBe(5);
  });
});

describe("data deletion service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.dataDeletionRequest.create.mockResolvedValue({ id: "dsr-1" });
    prismaMock.securityAuditLog.create.mockResolvedValue({ id: "audit-1" });
  });

  it("creates audited deletion request", async () => {
    const request = await dataDeletionService.createRequest({
      organisationId: "org-1",
      requestedById: "user-1",
      subjectEmail: "subject@test.com",
    });
    expect(request.id).toBe("dsr-1");
    expect(prismaMock.securityAuditLog.create).toHaveBeenCalled();
  });
});
