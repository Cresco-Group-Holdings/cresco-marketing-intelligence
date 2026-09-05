import type { NextRequest } from "next/server";

/** Vercel Cron user-agent prefix (observability only — not an auth signal). */
export const VERCEL_CRON_USER_AGENT_PREFIX = "vercel-cron/";

export type CronTransportContext = {
  userAgent: string | null;
  vercelCronSchedule: string | null;
};

/**
 * Captures Vercel Cron transport metadata for scheduler observability.
 * CRON_SECRET remains the sole authentication boundary.
 */
export function extractCronTransportContext(request: NextRequest): CronTransportContext {
  return {
    userAgent: request.headers.get("user-agent"),
    vercelCronSchedule: request.headers.get("x-vercel-cron-schedule"),
  };
}

export function isVercelCronUserAgent(userAgent: string | null | undefined): boolean {
  return typeof userAgent === "string" && userAgent.startsWith(VERCEL_CRON_USER_AGENT_PREFIX);
}
