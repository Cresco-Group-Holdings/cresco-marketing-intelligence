import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/server/services/daily-cron-dispatch-service", () => ({
  dailyCronDispatchService: {
    run: vi.fn().mockResolvedValue({
      gate: { allowed: true },
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 1,
      jobs: [],
    }),
  },
}));

const recordDailyDispatchMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/server/services/scheduler-health-service", () => ({
  schedulerHealthService: {
    recordDailyDispatch: (...args: unknown[]) => recordDailyDispatchMock(...args),
  },
}));

import { GET, POST, dynamic as dailyDispatchDynamic } from "@/app/api/cron/daily-dispatch/route";

function request(
  init: { method?: string; headers?: Record<string, string> } = {},
) {
  return new NextRequest("https://app.test/api/cron/daily-dispatch", {
    method: init.method ?? "GET",
    headers: init.headers,
  });
}

describe("daily cron dispatch route", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "cron-test-secret";
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
  });

  it("exports force-dynamic route configuration", () => {
    expect(dailyDispatchDynamic).toBe("force-dynamic");
  });

  it("accepts GET with cron secret and records heartbeat transport metadata", async () => {
    const response = await GET(
      request({
        headers: {
          authorization: "Bearer cron-test-secret",
          "user-agent": "vercel-cron/1.0",
          "x-vercel-cron-schedule": "0 2 * * *",
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(recordDailyDispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        transport: {
          userAgent: "vercel-cron/1.0",
          vercelCronSchedule: "0 2 * * *",
        },
      }),
    );
  });

  it("POST mirrors GET semantics", async () => {
    const response = await POST(
      request({
        method: "POST",
        headers: { authorization: "Bearer cron-test-secret" },
      }),
    );
    expect(response.status).toBe(200);
    expect(recordDailyDispatchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects GET with invalid cron secret", async () => {
    const response = await GET(
      request({ headers: { authorization: "Bearer invalid-secret" } }),
    );
    expect(response.status).toBe(403);
    expect(recordDailyDispatchMock).not.toHaveBeenCalled();
  });

  it("rejects worker token without cron secret", async () => {
    process.env.PUBLISHING_WORKER_TOKEN = "worker-only";
    const response = await GET(request({ headers: { authorization: "Bearer worker-only" } }));
    expect(response.status).toBe(403);
    delete process.env.PUBLISHING_WORKER_TOKEN;
  });

  it("rejects unauthenticated requests", async () => {
    const response = await GET(request());
    expect(response.status).toBe(403);
  });
});
