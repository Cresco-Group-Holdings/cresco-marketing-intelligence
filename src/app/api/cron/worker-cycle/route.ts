import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { extractCronTransportContext } from "@/lib/api/cron-transport";
import { isAuthorisedCronRequest } from "@/lib/api/worker-auth";
import { PRIMARY_SCHEDULER_SOURCE } from "@/lib/deployment/scheduling";
import { workerCycleService } from "@/server/services/worker-cycle-service";

/** Vercel Cron must always execute dynamically — never serve a cached/static response. */
export const dynamic = "force-dynamic";

async function executeWorkerCycle(request: NextRequest) {
  const requestId = randomUUID();
  if (!isAuthorisedCronRequest(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Scheduler authorization failed." }, requestId },
      { status: 403 },
    );
  }

  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;
  const transport = extractCronTransportContext(request);

  const result = await workerCycleService.run({
    cycleId: requestId,
    source: PRIMARY_SCHEDULER_SOURCE,
    workerId: `vercel-cron-${requestId}`,
    limit,
    includeLegacyPublishing: true,
    transport,
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
 * Vercel Cron invokes this route with HTTP GET. POST is retained for manual/internal
 * execution with identical semantics.
 */
export async function GET(request: NextRequest) {
  return executeWorkerCycle(request);
}

export async function POST(request: NextRequest) {
  return executeWorkerCycle(request);
}
