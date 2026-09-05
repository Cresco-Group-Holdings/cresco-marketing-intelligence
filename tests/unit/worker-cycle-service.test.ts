import { beforeEach, describe, expect, it, vi } from "vitest";

const recordCycleMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const recoverExpiredJobsMock = vi.hoisted(() => vi.fn().mockResolvedValue(0));
const dispatchDueJobsMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ discovered: 0, created: 0, activated: 0, skipped: 0, byType: {} }),
);
const dispatchDueSchedulesMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ evaluated: 0, triggered: 0, skipped: 0, executionIds: [] }),
);
const processAvailableJobsMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    claimed: 0,
    succeeded: 0,
    failed: 0,
    retrying: 0,
    skipped: 0,
    deadLettered: 0,
    durationMs: 0,
  }),
);
const getHealthMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ lagMs: 0, missedHeartbeat: false }),
);

vi.mock("@/server/services/scheduler-health-service", () => ({
  schedulerHealthService: {
    recordCycle: (...args: unknown[]) => recordCycleMock(...args),
    getHealth: (...args: unknown[]) => getHealthMock(...args),
  },
}));

vi.mock("@/server/services/worker-job-service", () => ({
  workerJobService: {
    recoverExpiredJobs: (...args: unknown[]) => recoverExpiredJobsMock(...args),
  },
}));

vi.mock("@/server/services/worker-dispatcher-service", () => ({
  workerDispatcherService: {
    dispatchDueJobs: (...args: unknown[]) => dispatchDueJobsMock(...args),
  },
}));

vi.mock("@/server/services/automation-schedule-service", () => ({
  automationScheduleService: {
    dispatchDueSchedules: (...args: unknown[]) => dispatchDueSchedulesMock(...args),
  },
}));

vi.mock("@/server/services/worker-executor-service", () => ({
  workerExecutorService: {
    processAvailableJobs: (...args: unknown[]) => processAvailableJobsMock(...args),
  },
}));

vi.mock("@/server/services/publishing-scheduler-service", () => ({
  publishingSchedulerService: {
    runSchedulerPass: vi.fn(),
  },
}));

vi.mock("@/lib/publishing/config", () => ({
  getPublishingConfig: () => ({ schedulerEnabled: false }),
}));

vi.mock("@/lib/workers/config", () => ({
  getWorkerPlatformConfig: () => ({ maxJobsPerInvocation: 25 }),
}));

import { workerCycleService } from "@/server/services/worker-cycle-service";

describe("workerCycleService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VERCEL_ENV = "production";
  });

  it("records cycle heartbeat with transport metadata", async () => {
    await workerCycleService.run({
      cycleId: "cycle-transport-1",
      source: "vercel_cron",
      includeLegacyPublishing: false,
      transport: {
        userAgent: "vercel-cron/1.0",
        vercelCronSchedule: "*/5 * * * *",
      },
    });

    expect(recordCycleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cycleId: "cycle-transport-1",
        source: "vercel_cron",
        transport: {
          userAgent: "vercel-cron/1.0",
          vercelCronSchedule: "*/5 * * * *",
        },
      }),
    );
  });

  it("skips fallback cycle when primary heartbeat is healthy", async () => {
    const result = await workerCycleService.run({
      source: "github_actions_fallback",
      fallbackOnlyIfStale: true,
    });

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe("PRIMARY_HEALTHY");
    expect(recoverExpiredJobsMock).not.toHaveBeenCalled();
    expect(recordCycleMock).toHaveBeenCalledWith(
      expect.objectContaining({ skipped: true, skipReason: "PRIMARY_HEALTHY" }),
    );
  });
});
