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

import { GET } from "@/app/api/cron/daily-dispatch/route";

function request(headers: Record<string, string> = {}) {
  return new NextRequest("https://app.test/api/cron/daily-dispatch", {
    method: "GET",
    headers,
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

  it("accepts GET with cron secret", async () => {
    const response = await GET(request({ authorization: "Bearer cron-test-secret" }));
    expect(response.status).toBe(200);
  });

  it("rejects worker token without cron secret", async () => {
    process.env.PUBLISHING_WORKER_TOKEN = "worker-only";
    const response = await GET(request({ authorization: "Bearer worker-only" }));
    expect(response.status).toBe(403);
    delete process.env.PUBLISHING_WORKER_TOKEN;
  });

  it("rejects unauthenticated requests", async () => {
    const response = await GET(request());
    expect(response.status).toBe(403);
  });
});
