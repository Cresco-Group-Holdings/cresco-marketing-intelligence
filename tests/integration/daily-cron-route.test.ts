import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/services/daily-cron-dispatcher-service", () => ({
  dailyCronDispatcherService: {
    dispatch: vi.fn(async () => ({
      skipped: false,
      workerId: "test-worker",
      jobs: { publishing_scheduler: { passes: [] } },
    })),
  },
}));

import { GET } from "@/app/api/cron/daily/route";

function request(method: string, headers?: HeadersInit) {
  return new NextRequest("https://app.test/api/cron/daily", { method, headers });
}

describe("daily cron route", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "cron-test-secret";
  });

  afterEach(() => {
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
  });

  it("accepts GET with cron secret for Vercel Cron invocations", async () => {
    const response = await GET(
      request("GET", { authorization: "Bearer cron-test-secret" }),
    );
    expect(response.status).toBe(200);
  });

  it("rejects unauthenticated cron requests", async () => {
    const response = await GET(request("GET"));
    expect(response.status).toBe(403);
  });
});
