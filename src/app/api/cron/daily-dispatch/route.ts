import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { extractCronTransportContext } from "@/lib/api/cron-transport";
import { isAuthorisedCronRequest } from "@/lib/api/worker-auth";
import { dailyCronDispatchService } from "@/server/services/daily-cron-dispatch-service";
import { schedulerHealthService } from "@/server/services/scheduler-health-service";

/** Vercel Cron must always execute dynamically — never serve a cached/static response. */
export const dynamic = "force-dynamic";

async function executeDailyDispatch(request: NextRequest) {
  const requestId = randomUUID();

  if (!isAuthorisedCronRequest(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Scheduler authorization failed." }, requestId },
      { status: 403 },
    );
  }

  const transport = extractCronTransportContext(request);

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
    transport,
  });

  return apiSuccess(result, { requestId });
}

/**
 * Vercel Hobby daily cron entry point.
 *
 * Vercel Cron invokes this route with HTTP GET. POST is retained for manual/internal
 * execution with identical semantics.
 */
export async function GET(request: NextRequest) {
  return executeDailyDispatch(request);
}

export async function POST(request: NextRequest) {
  return executeDailyDispatch(request);
}
