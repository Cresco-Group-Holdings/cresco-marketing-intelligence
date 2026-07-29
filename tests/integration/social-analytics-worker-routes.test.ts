import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const syncService = vi.hoisted(() => ({
  process: vi.fn(),
  processDue: vi.fn(),
}));
const schedulerService = vi.hoisted(() => ({
  runSchedulerPass: vi.fn(),
}));

vi.mock("@/server/services/social-analytics-sync-service", () => ({
  socialAnalyticsSyncService: syncService,
}));
vi.mock("@/server/services/social-analytics-scheduler-service", () => ({
  socialAnalyticsSchedulerService: schedulerService,
}));

import { POST as processSync } from "@/app/api/social-analytics-sync/[syncId]/process/route";
import { POST as processDue } from "@/app/api/social-analytics-sync/process-due/route";
import { POST as runSchedule } from "@/app/api/social-analytics-sync/schedule/route";

const TOKEN = "worker-secret-token";

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://app.test${path}`, { method: "POST", headers });
}

const authorised = { authorization: `Bearer ${TOKEN}` };
const params = (syncId: string) => ({ params: Promise.resolve({ syncId }) });

/** Each analytics worker endpoint, invoked through its real route handler. */
const endpoints = [
  {
    name: "process one sync",
    call: (headers: Record<string, string> = {}) =>
      processSync(request("/api/social-analytics-sync/sync-1/process", headers), params("sync-1")),
  },
  {
    name: "process due syncs",
    call: (headers: Record<string, string> = {}) =>
      processDue(request("/api/social-analytics-sync/process-due", headers)),
  },
  {
    name: "run the scheduler",
    call: (headers: Record<string, string> = {}) =>
      runSchedule(request("/api/social-analytics-sync/schedule", headers)),
  },
];

describe("social analytics worker route authorization", () => {
  const originalToken = process.env.PUBLISHING_WORKER_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PUBLISHING_WORKER_TOKEN = TOKEN;
    syncService.process.mockResolvedValue({ status: "COMPLETED", postsProcessed: 1 });
    syncService.processDue.mockResolvedValue([]);
    schedulerService.runSchedulerPass.mockResolvedValue({
      scheduled: { windowStart: "2026-07-29T12:00:00.000Z", enqueued: [], skipped: [] },
      processed: [],
    });
  });

  afterEach(() => {
    if (originalToken === undefined) delete process.env.PUBLISHING_WORKER_TOKEN;
    else process.env.PUBLISHING_WORKER_TOKEN = originalToken;
  });

  for (const endpoint of endpoints) {
    describe(endpoint.name, () => {
      it("accepts the configured bearer token", async () => {
        const response = await endpoint.call(authorised);
        expect(response.status).toBe(200);
      });

      it("rejects a missing authorization header", async () => {
        const response = await endpoint.call();
        expect(response.status).toBe(403);
        expect((await response.json()).error.code).toBe("FORBIDDEN");
      });

      it("rejects an incorrect token", async () => {
        const response = await endpoint.call({ authorization: "Bearer wrong-token-value" });
        expect(response.status).toBe(403);
      });

      it("rejects a non-bearer authorization scheme", async () => {
        const response = await endpoint.call({ authorization: `Basic ${TOKEN}` });
        expect(response.status).toBe(403);
      });

      it("rejects every request when the worker secret is unconfigured", async () => {
        delete process.env.PUBLISHING_WORKER_TOKEN;
        const response = await endpoint.call(authorised);
        expect(response.status).toBe(403);
      });

      it("does not reach the service when authorization fails", async () => {
        await endpoint.call({ authorization: "Bearer nope" });
        expect(syncService.process).not.toHaveBeenCalled();
        expect(syncService.processDue).not.toHaveBeenCalled();
        expect(schedulerService.runSchedulerPass).not.toHaveBeenCalled();
      });
    });
  }

  it("runs the requested sync when authorized", async () => {
    const response = await processSync(
      request("/api/social-analytics-sync/sync-42/process", authorised),
      params("sync-42"),
    );
    expect(response.status).toBe(200);
    expect(syncService.process).toHaveBeenCalledWith("sync-42", expect.stringMatching(/^worker-/));
    expect((await response.json()).data.result).toMatchObject({ status: "COMPLETED" });
  });

  it("returns null for a sync the worker cannot claim rather than leaking other tenants' work", async () => {
    syncService.process.mockResolvedValue(null);
    const response = await processSync(
      request("/api/social-analytics-sync/other-tenant-sync/process", authorised),
      params("other-tenant-sync"),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data.result).toBeNull();
  });

  it("honours the requested batch limit when draining due work", async () => {
    const response = await processDue(
      request("/api/social-analytics-sync/process-due?limit=3", authorised),
    );
    expect(response.status).toBe(200);
    expect(syncService.processDue).toHaveBeenCalledWith(3, expect.stringMatching(/^worker-/));
  });

  it("falls back to the configured batch size for an invalid limit", async () => {
    await processDue(request("/api/social-analytics-sync/process-due?limit=nonsense", authorised));
    expect(syncService.processDue).toHaveBeenCalledWith(10, expect.stringMatching(/^worker-/));
  });

  it("enqueues and drains in one authorized scheduler invocation", async () => {
    const response = await runSchedule(
      request("/api/social-analytics-sync/schedule?limit=5", authorised),
    );
    expect(response.status).toBe(200);
    expect(schedulerService.runSchedulerPass).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5, workerId: expect.stringMatching(/^scheduler-/) }),
    );
    expect((await response.json()).data.scheduled.windowStart).toBe("2026-07-29T12:00:00.000Z");
  });
});
