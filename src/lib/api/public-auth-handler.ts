import { NextRequest, NextResponse } from "next/server";
import { createRequestId, apiSuccess, handleApiError } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import { logSignupCatch } from "@/lib/auth/signup-trace";
import { assertSameOrigin } from "@/lib/security/csrf";
import { enforceAuthRateLimit } from "@/lib/security/auth-rate-limit";
import { getClientIpAddress } from "@/lib/auth/request";

export type PublicAuthHandlerContext = {
  request: NextRequest;
  requestId: string;
  ipAddress?: string;
};

export async function withPublicAuthHandler(
  request: NextRequest,
  handler: (context: PublicAuthHandlerContext) => Promise<NextResponse>,
  options?: {
    rateLimitAction?: Parameters<typeof enforceAuthRateLimit>[0];
    rateLimitKey?: string;
    requireJson?: boolean;
  },
): Promise<NextResponse> {
  const requestId = createRequestId();
  const ipAddress = getClientIpAddress(request);

  try {
    if (request.method !== "GET") {
      assertSameOrigin(request);
    }

    if (options?.rateLimitAction) {
      const key = options.rateLimitKey ?? ipAddress ?? "unknown";
      enforceAuthRateLimit(options.rateLimitAction, key);
    }

    return await handler({ request, requestId, ipAddress });
  } catch (error) {
    if (request.nextUrl.pathname.includes("/api/auth/signup")) {
      logSignupCatch("withPublicAuthHandler", requestId, error);
    }
    return handleApiError(error, requestId);
  }
}

export function requireJsonContentType(request: NextRequest): void {
  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    throw new AppError("VALIDATION_ERROR", "Request body must be JSON.");
  }
}

export { apiSuccess };
