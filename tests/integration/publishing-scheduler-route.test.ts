import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/server/services/publishing-scheduler-service", () => ({
  publishingSchedulerService: {
    runSchedulerPass: vi.fn().mockResolvedValue({
      enqueued: [],
      skipped: [],
      processed: 0,
    }),
  },
}));

import { GET, POST } from "@/app/api/publishing-scheduler/process-due/route";

const TOKEN = "scheduler-route-test-token";

function request(method: "GET" | "POST", headers: Record<string, string> = {}) {
  return new NextRequest("https://app.test/api/publishing-scheduler/process-due", {
    method,
    headers,
  });
}

describe("publishing scheduler route", () => {
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

  it("accepts GET with cron secret for Vercel Cron invocations", async () => {
    const response = await GET(
      request("GET", { authorization: "Bearer cron-test-secret" }),
    );
    expect(response.status).toBe(200);
  });

  it("accepts POST with worker token for manual invocations", async () => {
    const response = await POST(request("POST", { authorization: `Bearer ${TOKEN}` }));
    expect(response.status).toBe(200);
  });

  it("rejects unauthenticated requests", async () => {
    const response = await GET(request("GET"));
    expect(response.status).toBe(403);
  });
});
