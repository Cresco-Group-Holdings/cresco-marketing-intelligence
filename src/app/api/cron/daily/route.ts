import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { isAuthorisedCronRequest } from "@/lib/api/worker-auth";
import { dailyCronDispatcherService } from "@/server/services/daily-cron-dispatcher-service";

async function handleDailyCron(request: NextRequest) {
  const requestId = randomUUID();
  if (!isAuthorisedCronRequest(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Cron authorization failed." }, requestId },
      { status: 403 },
    );
  }

  const result = await dailyCronDispatcherService.dispatch({
    workerId: `vercel-cron-${requestId}`,
  });

  return apiSuccess(result, { requestId });
}

/**
 * Vercel Hobby entry point. A single daily cron invokes all platform maintenance schedulers.
 * High-frequency schedules remain available via worker-token endpoints or Vercel Pro cron.
 */
export async function GET(request: NextRequest) {
  return handleDailyCron(request);
}

export async function POST(request: NextRequest) {
  return handleDailyCron(request);
}
