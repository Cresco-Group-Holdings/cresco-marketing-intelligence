import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/server/services/scheduler-health-service", () => ({
  schedulerHealthService: {
    recordDispatch: vi.fn().mockResolvedValue(undefined),
    recordProcess: vi.fn().mockResolvedValue(undefined),
    recordRecover: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/server/services/worker-dispatcher-service", () => ({
  workerDispatcherService: {
    dispatchDueJobs: vi.fn().mockResolvedValue({ discovered: 0, created: 0, activated: 0, skipped: 0, byType: {} }),
  },
}));

vi.mock("@/server/services/automation-schedule-service", () => ({
  automationScheduleService: {
    dispatchDueSchedules: vi.fn().mockResolvedValue({
      evaluated: 0,
      triggered: 0,
      skipped: 0,
      executionIds: [],
    }),
  },
}));

vi.mock("@/server/services/worker-job-service", () => ({
  workerJobService: {
    recoverExpiredJobs: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock("@/server/services/worker-executor-service", () => ({
  workerExecutorService: {
    processAvailableJobs: vi.fn().mockResolvedValue({
      claimed: 0,
      succeeded: 0,
      failed: 0,
      retrying: 0,
      skipped: 0,
      deadLettered: 0,
      durationMs: 1,
    }),
  },
}));

import { GET as dispatchGet } from "@/app/api/workers/dispatch/route";
import { GET as processGet } from "@/app/api/workers/process/route";
import { GET as recoverGet } from "@/app/api/workers/recover/route";
import { GET as automationSchedulesGet } from "@/app/api/workers/automation-schedules/route";

const TOKEN = "worker-platform-test-token";

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://app.test${path}`, { method: "GET", headers });
}

describe("worker platform routes auth", () => {
  const originalWorkerToken = process.env.PUBLISHING_WORKER_TOKEN;
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.PUBLISHING_WORKER_TOKEN = TOKEN;
    process.env.CRON_SECRET = "cron-test-secret";
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalWorkerToken === undefined) delete process.env.PUBLISHING_WORKER_TOKEN;
    else process.env.PUBLISHING_WORKER_TOKEN = originalWorkerToken;
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
  });

  it("rejects unauthenticated dispatch", async () => {
    const response = await dispatchGet(request("/api/workers/dispatch"));
    expect(response.status).toBe(403);
  });

  it("accepts cron secret for dispatch", async () => {
    const response = await dispatchGet(
      request("/api/workers/dispatch", { authorization: "Bearer cron-test-secret" }),
    );
    expect(response.status).toBe(200);
  });

  it("accepts worker token for process", async () => {
    const response = await processGet(
      request("/api/workers/process", { authorization: `Bearer ${TOKEN}` }),
    );
    expect(response.status).toBe(200);
  });

  it("rejects unauthenticated recover and automation-schedules", async () => {
    const recover = await recoverGet(request("/api/workers/recover"));
    const schedules = await automationSchedulesGet(request("/api/workers/automation-schedules"));
    expect(recover.status).toBe(403);
    expect(schedules.status).toBe(403);
  });

  it("accepts worker token for recover and automation-schedules", async () => {
    const recover = await recoverGet(
      request("/api/workers/recover", { authorization: `Bearer ${TOKEN}` }),
    );
    const schedules = await automationSchedulesGet(
      request("/api/workers/automation-schedules", { authorization: `Bearer ${TOKEN}` }),
    );
    expect(recover.status).toBe(200);
    expect(schedules.status).toBe(200);
  });
});
