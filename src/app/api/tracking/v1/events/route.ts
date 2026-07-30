import { NextRequest, NextResponse } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { createRequestId, handleApiError } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { TRACKING_RATE_LIMIT_PER_MINUTE } from "@/lib/tracking/constants";
import { withTrackingCors, trackingCorsHeaders } from "@/lib/tracking/cors";
import { normaliseOrigin } from "@/lib/tracking/payload-sanitize";
import { trackingIngestSchema } from "@/lib/validation/tracking";
import { trackingIngestionService } from "@/server/services/tracking-ingestion-service";

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function OPTIONS(request: NextRequest) {
  const origin = normaliseOrigin(request.headers.get("origin"));
  return new NextResponse(null, {
    status: 204,
    headers: trackingCorsHeaders(origin),
  });
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const origin = normaliseOrigin(request.headers.get("origin"));

  try {
    const body = await request.json();
    const parsed = trackingIngestSchema.safeParse(body);
    if (!parsed.success) {
      const response = handleApiError(
        { code: "VALIDATION_ERROR", message: parsed.error.issues.map((i) => i.message).join(", ") },
        requestId,
      );
      return withTrackingCors(response, origin);
    }

    const rate = checkRateLimit({
      key: `tracking:${parsed.data.propertyId}:${clientIp(request)}`,
      limit: TRACKING_RATE_LIMIT_PER_MINUTE,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      const response = handleApiError(
        { code: "RATE_LIMITED", message: "Too many tracking events." },
        requestId,
      );
      response.headers.set("Retry-After", String(Math.ceil((rate.resetAt - Date.now()) / 1000)));
      return withTrackingCors(response, origin);
    }

    const result = await trackingIngestionService.ingestBatch(parsed.data, {
      origin,
      userAgent: request.headers.get("user-agent"),
      clientIp: clientIp(request),
    });

    const response = apiSuccess(result, { requestId });
    return withTrackingCors(response, origin);
  } catch (error) {
    const response = handleApiError(error, requestId);
    return withTrackingCors(response, origin);
  }
}
