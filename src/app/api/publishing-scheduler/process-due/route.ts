import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { isAuthorisedSchedulerRequest } from "@/lib/api/worker-auth";
import { getPublishingConfig } from "@/lib/publishing/config";
import { publishingSchedulerService } from "@/server/services/publishing-scheduler-service";
import { workerDispatcherService } from "@/server/services/worker-dispatcher-service";
import { workerExecutorService } from "@/server/services/worker-executor-service";

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
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : config.maxJobsPerWorkerRun;
  const workerId = `scheduler-${requestId}`;

  const dispatch = await workerDispatcherService.dispatchDueJobs({ limit });
  const worker = await workerExecutorService.processAvailableJobs({ workerId, limit });
  const result = await publishingSchedulerService.runSchedulerPass({ limit, workerId });

  return apiSuccess({ dispatch, worker, ...result }, { requestId });
}

/**
 * Cron entry point. Enqueues due ContentSchedule rows as PublishingJob records and immediately
 * drains due work so a single scheduled invocation keeps publishing on time.
 *
 * Manual / high-frequency entry point. On Vercel Hobby, publishing is invoked by the
 * daily dispatcher at /api/cron/daily-dispatch (see vercel.json and docs/PUBLISHING_SCHEDULER.md).
 * Production target cadence: every 5 minutes via Vercel Pro or external scheduler.
 */
export async function GET(request: NextRequest) {
  return handleProcessDue(request);
}

export async function POST(request: NextRequest) {
  return handleProcessDue(request);
}
