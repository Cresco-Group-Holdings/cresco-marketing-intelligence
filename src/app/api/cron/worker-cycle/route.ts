import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { isAuthorisedCronRequest } from "@/lib/api/worker-auth";
import { PRIMARY_SCHEDULER_SOURCE } from "@/lib/deployment/scheduling";
import { workerCycleService } from "@/server/services/worker-cycle-service";

async function handleWorkerCycle(request: NextRequest) {
  const requestId = randomUUID();
  if (!isAuthorisedCronRequest(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Scheduler authorization failed." }, requestId },
      { status: 403 },
    );
  }

  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

  const result = await workerCycleService.run({
    cycleId: requestId,
    source: PRIMARY_SCHEDULER_SOURCE,
    workerId: `vercel-cron-${requestId}`,
    limit,
    includeLegacyPublishing: true,
  });

  if (result.degraded) {
    return NextResponse.json(
      {
        success: false,
        data: result,
        meta: { requestId },
        error: {
          code: "WORKER_CYCLE_DEGRADED",
          message: result.publishingError ?? "Worker cycle completed with degraded publishing.",
          requestId,
        },
      },
      { status: 503 },
    );
  }

  return apiSuccess(result, { requestId });
}

/**
 * Primary launch scheduler entry point (Vercel Pro cron, every 5 minutes).
 *
 * Invokes the canonical worker cycle: recover → dispatch → automation schedules → process.
 * Business logic lives in workerCycleService — this route is a thin authenticated trigger.
 */
export async function GET(request: NextRequest) {
  return handleWorkerCycle(request);
}

export async function POST(request: NextRequest) {
  return handleWorkerCycle(request);
}
