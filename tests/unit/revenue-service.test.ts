import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const prismaMock = vi.hoisted(() => ({
  revenueCustomer: { findFirst: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), count: vi.fn() },
  revenueTransaction: { upsert: vi.fn(), count: vi.fn() },
  revenueSyncRun: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  revenueSubscription: { upsert: vi.fn(), findMany: vi.fn() },
  revenueCustomerIdentityLink: { upsert: vi.fn() },
  marketingIdentity: { findFirst: vi.fn() },
  marketingCostRecord: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: { getById: vi.fn().mockResolvedValue({ id: "brand-1", projectId: "project-1" }) },
}));
vi.mock("@/lib/revenue/adapters", () => ({
  getRevenueAdapter: vi.fn(() => ({
    sourceType: "STRIPE",
    isAvailable: () => false,
    sync: vi.fn(),
  })),
  listAvailableRevenueAdapters: vi.fn(() => [{ sourceType: "STRIPE", available: false }]),
}));

import { revenueSyncService } from "@/server/services/revenue-sync-service";
import { revenueDashboardService } from "@/server/services/revenue-dashboard-service";

const tenant = {
  organisationId: "org-1",
  userProfileId: "user-1",
  userId: "user-1",
  organisationRole: OrganisationRole.ADMIN,
};

describe("revenue permissions", () => {
  it("restricts sync to authorised roles", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["marketingData.runSync"])).toBe(false);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["marketingData.runSync"])).toBe(true);
  });
});

describe("revenue sync service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips sync when Stripe is not configured", async () => {
    const result = await revenueSyncService.sync("brand-1", "org-1", "STRIPE", tenant);
    expect(result).toEqual({ status: "SKIPPED", reason: "STRIPE adapter is not configured." });
  });

  it("imports manual revenue rows", async () => {
    prismaMock.revenueCustomer.upsert.mockResolvedValue({});
    prismaMock.revenueCustomer.findFirst.mockResolvedValue({ id: "cust-1" });
    prismaMock.revenueTransaction.upsert.mockResolvedValue({});

    const result = await revenueSyncService.importManual(
      "brand-1",
      "org-1",
      [{ providerCustomerId: "manual-1", amount: 99, currency: "USD", occurredAt: "2026-01-01T00:00:00Z" }],
      tenant,
    );
    expect(result.recordsSynced).toBe(1);
  });

  it("detects duplicate webhook processing", async () => {
    prismaMock.revenueSyncRun.findUnique.mockResolvedValue({ id: "run-1" });
    const duplicate = await revenueSyncService.isWebhookProcessed("key-1");
    expect(duplicate).toBe(true);
  });
});

describe("revenue dashboard cross-tenant", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty customers for tenant-scoped queries", async () => {
    prismaMock.revenueCustomer.findMany.mockResolvedValue([]);
    const customers = await revenueDashboardService.getCustomers("brand-1", "org-1", tenant);
    expect(customers).toHaveLength(0);
    expect(prismaMock.revenueCustomer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ brandId: "brand-1", organisationId: "org-1" }) }),
    );
  });
});
