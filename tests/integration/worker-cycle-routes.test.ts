import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const runMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/worker-cycle-service", () => ({
  workerCycleService: {
    run: (...args: unknown[]) => runMock(...args),
  },
}));

import { GET as workerCycleGet } from "@/app/api/cron/worker-cycle/route";
import { GET as fallbackCycleGet } from "@/app/api/workers/fallback-cycle/route";

const CRON_SECRET = "cron-test-secret";
const WORKER_TOKEN = "worker-test-token";

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://app.test${path}`, { method: "GET", headers });
}

describe("worker cycle routes", () => {
  const originalCron = process.env.CRON_SECRET;
  const originalWorker = process.env.PUBLISHING_WORKER_TOKEN;

  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
    process.env.PUBLISHING_WORKER_TOKEN = WORKER_TOKEN;
    runMock.mockResolvedValue({
      cycleId: "cycle-1",
      source: "vercel_cron",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 10,
      success: true,
      degraded: false,
      skipped: false,
      recover: { recovered: 0 },
      dispatch: { discovered: 0, created: 0, activated: 0, skipped: 0, byType: {} },
      automation: { evaluated: 0, triggered: 0, skipped: 0, executionIds: [] },
      process: {
        claimed: 0,
        succeeded: 0,
        failed: 0,
        retrying: 0,
        skipped: 0,
        deadLettered: 0,
        durationMs: 0,
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCron;
    if (originalWorker === undefined) delete process.env.PUBLISHING_WORKER_TOKEN;
    else process.env.PUBLISHING_WORKER_TOKEN = originalWorker;
  });

  it("rejects worker-cycle without cron secret", async () => {
    const response = await workerCycleGet(request("/api/cron/worker-cycle"));
    expect(response.status).toBe(403);
  });

  it("accepts worker-cycle with valid cron secret", async () => {
    const response = await workerCycleGet(
      request("/api/cron/worker-cycle", { authorization: `Bearer ${CRON_SECRET}` }),
    );
    expect(response.status).toBe(200);
    expect(runMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: "vercel_cron", includeLegacyPublishing: true }),
    );
  });

  it("rejects fallback-cycle without scheduler auth", async () => {
    const response = await fallbackCycleGet(request("/api/workers/fallback-cycle"));
    expect(response.status).toBe(403);
  });

  it("accepts fallback-cycle with worker token and stale-only mode", async () => {
    const response = await fallbackCycleGet(
      request("/api/workers/fallback-cycle", { authorization: `Bearer ${WORKER_TOKEN}` }),
    );
    expect(response.status).toBe(200);
    expect(runMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "github_actions_fallback",
        fallbackOnlyIfStale: true,
      }),
    );
  });

  it("returns degraded response when publishing leg fails", async () => {
    runMock.mockResolvedValueOnce({
      cycleId: "cycle-2",
      source: "vercel_cron",
      success: false,
      degraded: true,
      skipped: false,
      publishingError: "provider unavailable",
    });

    const response = await workerCycleGet(
      request("/api/cron/worker-cycle", { authorization: `Bearer ${CRON_SECRET}` }),
    );
    expect(response.status).toBe(503);
  });
});
