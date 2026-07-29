import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  socialAccount: { findMany: vi.fn() },
  socialAnalyticsSync: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
}));
const syncService = vi.hoisted(() => ({ processDue: vi.fn() }));

vi.mock("@/lib/database/prisma", () => ({ prisma }));
vi.mock("@/server/services/social-analytics-sync-service", () => ({
  socialAnalyticsSyncService: syncService,
}));

import { scheduleWindowStart, scheduledSyncIdempotencyKey } from "@/lib/analytics/config";
import { socialAnalyticsSchedulerService } from "@/server/services/social-analytics-scheduler-service";

const account = (overrides: Record<string, unknown> = {}) => ({
  id: "account-1",
  organisationId: "org-1",
  projectId: "project-1",
  brandId: "brand-1",
  provider: "INSTAGRAM",
  ...overrides,
});

const now = new Date("2026-07-29T13:05:00Z");

describe("socialAnalyticsSchedulerService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SOCIAL_ANALYTICS_SYNC_ENABLED;
    prisma.socialAccount.findMany.mockResolvedValue([account()]);
    prisma.socialAnalyticsSync.findUnique.mockResolvedValue(null);
    prisma.socialAnalyticsSync.findFirst.mockResolvedValue(null);
    prisma.socialAnalyticsSync.create.mockResolvedValue({ id: "sync-1" });
    syncService.processDue.mockResolvedValue([]);
  });

  it("only considers connected, insight-capable accounts in active tenants", async () => {
    await socialAnalyticsSchedulerService.enqueueDueAccounts(now);
    const where = prisma.socialAccount.findMany.mock.calls[0]![0].where;
    expect(where.status).toBe("CONNECTED");
    expect(where.socialConnection).toEqual({ status: "CONNECTED", reconnectRequiredAt: null });
    expect(where.capabilities).toEqual({ some: { capability: "READ_INSIGHTS" } });
    expect(where.brand).toEqual({
      status: "ACTIVE",
      archivedAt: null,
      organisation: { status: "ACTIVE", archivedAt: null },
    });
  });

  it("enqueues the first run as an initial sync with a backfill window", async () => {
    const outcome = await socialAnalyticsSchedulerService.enqueueDueAccounts(now);
    expect(outcome.enqueued).toEqual([
      { socialAccountId: "account-1", syncId: "sync-1", syncType: "INITIAL" },
    ]);
    const data = prisma.socialAnalyticsSync.create.mock.calls[0]![0].data;
    expect(data.syncType).toBe("INITIAL");
    expect(data.backfillFrom).toBeInstanceOf(Date);
    expect(data.backfillTo).toBeInstanceOf(Date);
    expect(data.idempotencyKey).toBe(
      scheduledSyncIdempotencyKey("account-1", scheduleWindowStart(now, 360)),
    );
  });

  it("enqueues later runs as scheduled syncs without a backfill window", async () => {
    prisma.socialAnalyticsSync.findFirst.mockResolvedValue({ id: "previous" });
    const outcome = await socialAnalyticsSchedulerService.enqueueDueAccounts(now);
    expect(outcome.enqueued[0]?.syncType).toBe("SCHEDULED");
    const data = prisma.socialAnalyticsSync.create.mock.calls[0]![0].data;
    expect(data.backfillFrom).toBeUndefined();
    expect(data.backfillTo).toBeUndefined();
  });

  it("collapses repeated runs inside one window onto a single job", async () => {
    prisma.socialAnalyticsSync.findUnique.mockResolvedValue({ id: "already-there" });
    const outcome = await socialAnalyticsSchedulerService.enqueueDueAccounts(now);
    expect(outcome.enqueued).toEqual([]);
    expect(outcome.skipped).toEqual([
      { socialAccountId: "account-1", reason: "ALREADY_SCHEDULED" },
    ]);
    expect(prisma.socialAnalyticsSync.create).not.toHaveBeenCalled();
  });

  it("buckets separate windows to distinct idempotency keys", () => {
    const first = scheduleWindowStart(new Date("2026-07-29T13:05:00Z"), 360);
    const second = scheduleWindowStart(new Date("2026-07-29T19:05:00Z"), 360);
    expect(scheduleWindowStart(new Date("2026-07-29T17:59:00Z"), 360).toISOString()).toBe(
      first.toISOString(),
    );
    expect(scheduledSyncIdempotencyKey("account-1", first)).not.toBe(
      scheduledSyncIdempotencyKey("account-1", second),
    );
  });

  it("stops enqueuing when the scheduler is disabled but leaves manual sync alone", async () => {
    process.env.SOCIAL_ANALYTICS_SYNC_ENABLED = "false";
    const outcome = await socialAnalyticsSchedulerService.enqueueDueAccounts(now);
    expect(outcome.enqueued).toEqual([]);
    expect(prisma.socialAccount.findMany).not.toHaveBeenCalled();
    delete process.env.SOCIAL_ANALYTICS_SYNC_ENABLED;
  });

  it("drains due work after enqueuing the window", async () => {
    syncService.processDue.mockResolvedValue([{ syncId: "sync-1", result: { status: "COMPLETED" } }]);
    const result = await socialAnalyticsSchedulerService.runSchedulerPass({
      now,
      limit: 4,
      workerId: "worker-x",
    });
    expect(syncService.processDue).toHaveBeenCalledWith(4, "worker-x");
    expect(result.processed).toHaveLength(1);
    expect(result.scheduled.enqueued).toHaveLength(1);
  });
});
