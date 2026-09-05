import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { isAuthorisedCronRequest } from "@/lib/api/worker-auth";
import { dailyCronDispatchService } from "@/server/services/daily-cron-dispatch-service";
import { schedulerHealthService } from "@/server/services/scheduler-health-service";

async function handleDailyDispatch(request: NextRequest) {
  const requestId = randomUUID();

  if (!isAuthorisedCronRequest(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Scheduler authorization failed." }, requestId },
      { status: 403 },
    );
  }

  const result = await dailyCronDispatchService.run({
    workerId: `vercel-cron-${requestId}`,
  });

  await schedulerHealthService.recordDailyDispatch({
    cycleId: requestId,
    startedAt: new Date(result.startedAt),
    completedAt: new Date(result.completedAt),
    durationMs: result.durationMs,
    success: result.gate.allowed,
    jobSummaries: result.jobs.map((job) => ({
      jobId: job.jobId,
      passes: job.passes,
      stoppedReason: job.stoppedReason,
    })),
  });

  return apiSuccess(result, { requestId });
}

/**
 * Vercel Hobby daily cron entry point.
 *
 * Registered in vercel.json (once per day). Fans out to internal job handlers in
 * bounded batches. High-frequency schedules remain documented in
 * src/lib/deployment/scheduling.ts for Pro / external workers.
 */
export async function GET(request: NextRequest) {
  return handleDailyDispatch(request);
}

export async function POST(request: NextRequest) {
  return handleDailyDispatch(request);
}
