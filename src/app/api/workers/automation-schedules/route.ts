import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { isAuthorisedSchedulerRequest } from "@/lib/api/worker-auth";
import { automationScheduleService } from "@/server/services/automation-schedule-service";
import { schedulerHealthService } from "@/server/services/scheduler-health-service";

async function handleAutomationSchedules(request: NextRequest) {
  const requestId = randomUUID();
  if (!isAuthorisedSchedulerRequest(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Worker authorization failed." }, requestId },
      { status: 403 },
    );
  }

  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50;

  const summary = await automationScheduleService.dispatchDueSchedules(new Date(), limit);
  await schedulerHealthService.recordDispatch({
    discovered: summary.evaluated,
    created: summary.triggered,
    activated: summary.executionIds.length,
    skipped: summary.skipped,
  });

  return apiSuccess({ summary }, { requestId });
}

export async function GET(request: NextRequest) {
  return handleAutomationSchedules(request);
}

export async function POST(request: NextRequest) {
  return handleAutomationSchedules(request);
}
