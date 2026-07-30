import { NextRequest, NextResponse } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { createRequestId, handleApiError } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  SUBMISSION_RATE_LIMIT_PER_MINUTE,
  SUBMISSION_RATE_LIMIT_PER_HOUR,
} from "@/lib/lead-capture-forms/constants";
import { leadCaptureSubmissionService } from "@/server/services/lead-capture-submission-service";

type Params = { params: Promise<{ publicFormId: string }> };

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Idempotency-Key",
    "Access-Control-Max-Age": "86400",
  };
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = createRequestId();
  const origin = request.headers.get("origin");
  const ip = clientIp(request);

  try {
    const { publicFormId } = await params;

    const minuteRate = checkRateLimit({
      key: `form-submit:${publicFormId}:${ip}:m`,
      limit: SUBMISSION_RATE_LIMIT_PER_MINUTE,
      windowMs: 60_000,
    });
    const hourRate = checkRateLimit({
      key: `form-submit:${publicFormId}:${ip}:h`,
      limit: SUBMISSION_RATE_LIMIT_PER_HOUR,
      windowMs: 3_600_000,
    });

    if (!minuteRate.allowed || !hourRate.allowed) {
      const response = handleApiError(
        { code: "RATE_LIMITED", message: "Too many submissions." },
        requestId,
      );
      response.headers.set("Retry-After", "60");
      Object.entries(corsHeaders(origin)).forEach(([k, v]) => response.headers.set(k, v));
      return response;
    }

    const body = await request.json();
    const idempotencyKey =
      request.headers.get("x-idempotency-key") ?? body.idempotencyKey ?? undefined;

    const result = await leadCaptureSubmissionService.submit(
      publicFormId,
      {
        fields: body.fields ?? {},
        consent: body.consent,
        idempotencyKey,
        attribution: body.attribution,
      },
      {
        origin,
        clientIp: ip,
        userAgent: request.headers.get("user-agent"),
        velocityExceeded: !minuteRate.allowed,
      },
    );

    const response = apiSuccess(result, { requestId });
    Object.entries(corsHeaders(origin)).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  } catch (error) {
    const response = handleApiError(error, requestId);
    Object.entries(corsHeaders(origin)).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }
}
