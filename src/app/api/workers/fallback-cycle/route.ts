import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { isAuthorisedSchedulerRequest } from "@/lib/api/worker-auth";
import { FALLBACK_SCHEDULER_SOURCE } from "@/lib/deployment/scheduling";
import { workerCycleService } from "@/server/services/worker-cycle-service";

async function handleFallbackCycle(request: NextRequest) {
  const requestId = randomUUID();
  if (!isAuthorisedSchedulerRequest(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Scheduler authorization failed." }, requestId },
      { status: 403 },
    );
  }

  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;
  const force = request.nextUrl.searchParams.get("force") === "true";

  const result = await workerCycleService.run({
    cycleId: requestId,
    source: FALLBACK_SCHEDULER_SOURCE,
    workerId: `gha-fallback-${requestId}`,
    limit,
    includeLegacyPublishing: true,
    fallbackOnlyIfStale: !force,
  });

  if (result.degraded) {
    return NextResponse.json(
      {
        success: false,
        data: result,
        meta: { requestId },
        error: {
          code: "WORKER_CYCLE_DEGRADED",
          message: result.publishingError ?? "Fallback worker cycle completed with degraded publishing.",
          requestId,
        },
      },
      { status: 503 },
    );
  }

  return apiSuccess(result, { requestId });
}

/**
 * GitHub Actions fallback scheduler — runs only when the primary Vercel cron heartbeat is stale.
 */
export async function GET(request: NextRequest) {
  return handleFallbackCycle(request);
}

export async function POST(request: NextRequest) {
  return handleFallbackCycle(request);
}
