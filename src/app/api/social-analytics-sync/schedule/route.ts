import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { isAuthorisedWorkerRequest } from "@/lib/api/worker-auth";
import { getAnalyticsSyncConfig } from "@/lib/analytics/config";
import { socialAnalyticsSchedulerService } from "@/server/services/social-analytics-scheduler-service";

/**
 * Cron entry point. Enqueues the recurring analytics syncs for the current window and immediately
 * drains due work so a single scheduled invocation is enough to keep analytics fresh.
 */
export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  if (!isAuthorisedWorkerRequest(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Worker authorization failed." }, requestId },
      { status: 403 },
    );
  }
  const config = getAnalyticsSyncConfig();
  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const result = await socialAnalyticsSchedulerService.runSchedulerPass({
    limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : config.maxSyncsPerWorkerRun,
    workerId: `scheduler-${requestId}`,
  });
  return apiSuccess(result, { requestId });
}
