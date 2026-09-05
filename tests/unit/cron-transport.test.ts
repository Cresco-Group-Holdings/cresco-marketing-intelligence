import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  VERCEL_CRON_USER_AGENT_PREFIX,
  extractCronTransportContext,
  isVercelCronUserAgent,
} from "@/lib/api/cron-transport";

describe("cron transport", () => {
  it("extracts Vercel Cron user-agent and schedule header", () => {
    const request = new NextRequest("https://app.test/api/cron/worker-cycle", {
      method: "GET",
      headers: {
        "user-agent": "vercel-cron/1.0",
        "x-vercel-cron-schedule": "*/5 * * * *",
      },
    });

    expect(extractCronTransportContext(request)).toEqual({
      userAgent: "vercel-cron/1.0",
      vercelCronSchedule: "*/5 * * * *",
    });
  });

  it("returns nulls when transport headers are absent", () => {
    const request = new NextRequest("https://app.test/api/cron/worker-cycle", {
      method: "GET",
    });

    expect(extractCronTransportContext(request)).toEqual({
      userAgent: null,
      vercelCronSchedule: null,
    });
  });

  it("detects Vercel Cron user-agent prefix without using it for auth", () => {
    expect(isVercelCronUserAgent(`${VERCEL_CRON_USER_AGENT_PREFIX}1.0`)).toBe(true);
    expect(isVercelCronUserAgent("curl/8.0")).toBe(false);
    expect(isVercelCronUserAgent(null)).toBe(false);
  });
});
