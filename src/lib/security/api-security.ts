import type { NextRequest } from "next/server";
import { createRequestId } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const API_MAX_BODY_BYTES = 5 * 1024 * 1024;
export const API_DEFAULT_RATE_LIMIT = 120;
export const API_RATE_WINDOW_MS = 60_000;

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function resolveRequestId(request: NextRequest): string {
  const incoming =
    request.headers.get("x-request-id") ??
    request.headers.get("x-correlation-id") ??
    request.headers.get("traceparent")?.split("-")[1];

  if (incoming && incoming.length >= 8 && incoming.length <= 128) {
    return incoming;
  }

  return createRequestId();
}

export function assertMutatingRequestSecurity(request: NextRequest, userId: string): void {
  if (MUTATING_METHODS.has(request.method)) {
    assertSameOrigin(request);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > API_MAX_BODY_BYTES) {
    throw new AppError("VALIDATION_ERROR", "Request body exceeds maximum allowed size.");
  }

  const rate = checkRateLimit({
    key: `api:${userId}:${request.nextUrl.pathname}`,
    limit: API_DEFAULT_RATE_LIMIT,
    windowMs: API_RATE_WINDOW_MS,
  });

  if (!rate.allowed) {
    throw new AppError("RATE_LIMITED", "Too many requests. Please try again shortly.");
  }
}

export function withRequestIdHeader<T extends Response>(response: T, requestId: string): T {
  response.headers.set("x-request-id", requestId);
  return response;
}
