import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

function bearerTokenMatches(request: NextRequest, expected: string): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const provided = header.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

/**
 * Publishing workers run outside the user session, so they authenticate with a shared
 * service token instead of tenant credentials. An unset token disables the endpoint.
 */
export function isAuthorisedWorkerRequest(request: NextRequest): boolean {
  const workerToken = process.env.WORKER_TOKEN?.trim() || process.env.PUBLISHING_WORKER_TOKEN?.trim();
  if (!workerToken) return false;
  return bearerTokenMatches(request, workerToken);
}

/**
 * Vercel Cron sends Authorization: Bearer <CRON_SECRET> when CRON_SECRET is configured.
 * Use for scheduled platform invocations only — not for tenant-scoped user traffic.
 */
export function isAuthorisedCronRequest(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;
  return bearerTokenMatches(request, expected);
}

/** Accepts either the worker service token (manual/ops) or the Vercel cron secret. */
export function isAuthorisedSchedulerRequest(request: NextRequest): boolean {
  return isAuthorisedWorkerRequest(request) || isAuthorisedCronRequest(request);
}
