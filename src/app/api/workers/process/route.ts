import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { isAuthorisedWorkerRequest } from "@/lib/api/worker-auth";
import { getWorkerPlatformConfig } from "@/lib/workers/config";
import { schedulerHealthService } from "@/server/services/scheduler-health-service";
import { workerExecutorService } from "@/server/services/worker-executor-service";

async function handleProcess(request: NextRequest) {
  const requestId = randomUUID();
  if (!isAuthorisedWorkerRequest(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Worker authorization failed." }, requestId },
      { status: 403 },
    );
  }

  const config = getWorkerPlatformConfig();
  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : config.maxJobsPerInvocation;

  const result = await workerExecutorService.processAvailableJobs({
    workerId: `worker-${requestId}`,
    limit,
  });

  await schedulerHealthService.recordProcess({
    claimed: result.claimed,
    succeeded: result.succeeded,
    failed: result.failed,
    retrying: result.retrying,
  });

  return apiSuccess(result, { requestId });
}

export async function GET(request: NextRequest) {
  return handleProcess(request);
}

export async function POST(request: NextRequest) {
  return handleProcess(request);
}
