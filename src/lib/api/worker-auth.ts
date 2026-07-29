import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Publishing workers run outside the user session, so they authenticate with a shared
 * service token instead of tenant credentials. An unset token disables the endpoint.
 */
export function isAuthorisedWorkerRequest(request: NextRequest): boolean {
  const expected = process.env.PUBLISHING_WORKER_TOKEN?.trim();
  if (!expected) return false;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const provided = header.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, providedBuffer);
}
