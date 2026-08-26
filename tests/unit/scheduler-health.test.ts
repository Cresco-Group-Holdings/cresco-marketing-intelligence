import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock, operationalAlertMock } = vi.hoisted(() => ({
  prismaMock: {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    workerJob: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    organisation: {
      findMany: vi.fn(),
    },
  },
  operationalAlertMock: {
    upsert: vi.fn(),
  },
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/operational-alert-service", () => ({
  operationalAlertService: operationalAlertMock,
}));

import { schedulerHealthService } from "@/server/services/scheduler-health-service";

describe("schedulerHealthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.workerJob.findFirst.mockResolvedValue(null);
    prismaMock.workerJob.count.mockResolvedValue(0);
    prismaMock.$queryRaw.mockResolvedValue([]);
  });

  it("flags missed heartbeat when lag exceeds 15 minutes", async () => {
    const stale = new Date(Date.now() - 20 * 60_000);
    prismaMock.$queryRaw.mockResolvedValue([
      {
        id: "global",
        lastInvokedAt: stale,
        lastSucceededAt: stale,
        invocationType: "dispatch",
        jobsDiscovered: 1,
        jobsCreated: 0,
        jobsActivated: 0,
        jobsClaimed: 0,
        jobsSucceeded: 0,
        oldestReadyDueAt: null,
        metadata: {},
        updatedAt: stale,
      },
    ]);
    prismaMock.organisation.findMany.mockResolvedValue([{ id: "org-1" }]);

    const health = await schedulerHealthService.getHealth();
    expect(health.missedHeartbeat).toBe(true);
    expect(health.lagMs).toBeGreaterThan(15 * 60_000);
  });
});
