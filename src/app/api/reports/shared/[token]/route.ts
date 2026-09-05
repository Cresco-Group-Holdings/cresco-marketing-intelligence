import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { createRequestId, handleApiError } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { socialReportService } from "@/server/services/social-report-service";

type Params = { params: Promise<{ token: string }> };

const SHARE_TOKEN_RATE_LIMIT_PER_MINUTE = 30;

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function GET(request: NextRequest, { params }: Params) {
  const requestId = createRequestId();
  const ip = clientIp(request);

  try {
    const rate = checkRateLimit({
      key: `shared-report:${ip}`,
      limit: SHARE_TOKEN_RATE_LIMIT_PER_MINUTE,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      const response = handleApiError(
        { code: "RATE_LIMITED", message: "Too many requests." },
        requestId,
      );
      response.headers.set("Retry-After", String(Math.ceil((rate.resetAt - Date.now()) / 1000)));
      return response;
    }

    const { token } = await params;
    return apiSuccess(await socialReportService.getByShareToken(token), { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
