import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const runMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/worker-cycle-service", () => ({
  workerCycleService: {
    run: (...args: unknown[]) => runMock(...args),
  },
}));

import { GET as workerCycleGet, POST as workerCyclePost } from "@/app/api/cron/worker-cycle/route";
import { GET as fallbackCycleGet } from "@/app/api/workers/fallback-cycle/route";
import { dynamic as workerCycleDynamic } from "@/app/api/cron/worker-cycle/route";

const CRON_SECRET = "cron-test-secret";
const WORKER_TOKEN = "worker-test-token";

function request(
  path: string,
  init: { method?: string; headers?: Record<string, string> } = {},
) {
  return new NextRequest(`https://app.test${path}`, {
    method: init.method ?? "GET",
    headers: init.headers,
  });
}

const successResult = {
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
};

describe("worker cycle routes", () => {
  const originalCron = process.env.CRON_SECRET;
  const originalWorker = process.env.PUBLISHING_WORKER_TOKEN;

  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
    process.env.PUBLISHING_WORKER_TOKEN = WORKER_TOKEN;
    runMock.mockResolvedValue(successResult);
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCron;
    if (originalWorker === undefined) delete process.env.PUBLISHING_WORKER_TOKEN;
    else process.env.PUBLISHING_WORKER_TOKEN = originalWorker;
  });

  it("exports force-dynamic route configuration", () => {
    expect(workerCycleDynamic).toBe("force-dynamic");
  });

  it("rejects GET worker-cycle without cron secret", async () => {
    const response = await workerCycleGet(request("/api/cron/worker-cycle"));
    expect(response.status).toBe(403);
    expect(runMock).not.toHaveBeenCalled();
  });

  it("rejects GET worker-cycle with invalid cron secret", async () => {
    const response = await workerCycleGet(
      request("/api/cron/worker-cycle", {
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );
    expect(response.status).toBe(403);
    expect(runMock).not.toHaveBeenCalled();
  });

  it("rejects GET worker-cycle when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const response = await workerCycleGet(
      request("/api/cron/worker-cycle", {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
    );
    expect(response.status).toBe(403);
    expect(runMock).not.toHaveBeenCalled();
  });

  it("accepts GET worker-cycle with valid cron secret and invokes workerCycleService once", async () => {
    const response = await workerCycleGet(
      request("/api/cron/worker-cycle", {
        headers: {
          authorization: `Bearer ${CRON_SECRET}`,
          "user-agent": "vercel-cron/1.0",
          "x-vercel-cron-schedule": "*/5 * * * *",
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(runMock).toHaveBeenCalledTimes(1);
    expect(runMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "vercel_cron",
        includeLegacyPublishing: true,
        transport: {
          userAgent: "vercel-cron/1.0",
          vercelCronSchedule: "*/5 * * * *",
        },
      }),
    );
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it("POST worker-cycle mirrors GET semantics", async () => {
    const response = await workerCyclePost(
      request("/api/cron/worker-cycle", {
        method: "POST",
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
    );
    expect(response.status).toBe(200);
    expect(runMock).toHaveBeenCalledTimes(1);
    expect(runMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: "vercel_cron", includeLegacyPublishing: true }),
    );
  });

  it("GET worker-cycle returns direct JSON without redirect", async () => {
    const response = await workerCycleGet(
      request("/api/cron/worker-cycle", {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
    );
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("handles concurrent GET invocations independently", async () => {
    const headers = { authorization: `Bearer ${CRON_SECRET}` };
    const [first, second] = await Promise.all([
      workerCycleGet(request("/api/cron/worker-cycle", { headers })),
      workerCycleGet(request("/api/cron/worker-cycle", { headers })),
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(runMock).toHaveBeenCalledTimes(2);
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
      request("/api/cron/worker-cycle", {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
  });

  it("rejects fallback-cycle without scheduler auth", async () => {
    const response = await fallbackCycleGet(request("/api/workers/fallback-cycle"));
    expect(response.status).toBe(403);
  });

  it("accepts fallback-cycle with worker token and stale-only mode", async () => {
    const response = await fallbackCycleGet(
      request("/api/workers/fallback-cycle", {
        headers: { authorization: `Bearer ${WORKER_TOKEN}` },
      }),
    );
    expect(response.status).toBe(200);
    expect(runMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "github_actions_fallback",
        fallbackOnlyIfStale: true,
      }),
    );
  });
});
