import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { isAuthorisedWorkerRequest } from "@/lib/api/worker-auth";
import { socialAnalyticsSyncService } from "@/server/services/social-analytics-sync-service";

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  if (!isAuthorisedWorkerRequest(request)) {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Worker authorization failed.",
        },
        requestId,
      },
      { status: 403 },
    );
  }
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 10);
  return apiSuccess(
    {
      results: await socialAnalyticsSyncService.processDue(limit),
    },
    { requestId },
  );
}
