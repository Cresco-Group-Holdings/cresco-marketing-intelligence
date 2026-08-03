import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { isAuthorisedSchedulerRequest } from "@/lib/api/worker-auth";
import { getPublishingConfig } from "@/lib/publishing/config";
import { publishingSchedulerService } from "@/server/services/publishing-scheduler-service";

async function handleProcessDue(request: NextRequest) {
  const requestId = randomUUID();
  if (!isAuthorisedSchedulerRequest(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Scheduler authorization failed." }, requestId },
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

/**
 * Cron entry point. Enqueues due ContentSchedule rows as PublishingJob records and immediately
 * drains due work so a single scheduled invocation keeps publishing on time.
 *
 * Production schedule: Vercel Cron (see vercel.json and docs/PUBLISHING_SCHEDULER.md).
 * Vercel invokes this route with GET + Authorization: Bearer $CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  return handleProcessDue(request);
}

export async function POST(request: NextRequest) {
  return handleProcessDue(request);
}
