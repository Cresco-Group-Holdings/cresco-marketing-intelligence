import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { isAuthorisedWorkerRequest } from "@/lib/api/worker-auth";
import { getPublishingConfig } from "@/lib/publishing/config";
import { publishingSchedulerService } from "@/server/services/publishing-scheduler-service";

/**
 * Cron entry point. Enqueues due ContentSchedule rows as PublishingJob records and immediately
 * drains due work so a single scheduled invocation keeps publishing on time.
 */
export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  if (!isAuthorisedWorkerRequest(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Worker authorization failed." }, requestId },
      { status: 403 },
    );
  }
  const config = getPublishingConfig();
  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const result = await publishingSchedulerService.runSchedulerPass({
    limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : config.maxJobsPerWorkerRun,
    workerId: `scheduler-${requestId}`,
  });
  return apiSuccess(result, { requestId });
}
