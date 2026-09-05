import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { isAuthorisedSchedulerRequest } from "@/lib/api/worker-auth";
import { schedulerHealthService } from "@/server/services/scheduler-health-service";
import { workerJobService } from "@/server/services/worker-job-service";

async function handleRecover(request: NextRequest) {
  const requestId = randomUUID();
  if (!isAuthorisedSchedulerRequest(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Worker authorization failed." }, requestId },
      { status: 403 },
    );
  }

  const recovered = await workerJobService.recoverExpiredJobs();
  await schedulerHealthService.recordRecover({ recovered, source: "recover" });
  return apiSuccess({ recovered }, { requestId });
}

export async function GET(request: NextRequest) {
  return handleRecover(request);
}

export async function POST(request: NextRequest) {
  return handleRecover(request);
}
