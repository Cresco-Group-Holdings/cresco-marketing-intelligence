import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { isAuthorisedSchedulerRequest } from "@/lib/api/worker-auth";
import { digitalAssetProcessingService } from "@/server/services/digital-asset-processing-service";

async function handleProcessDue(request: NextRequest) {
  const requestId = randomUUID();
  if (!isAuthorisedSchedulerRequest(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Scheduler authorization failed." }, requestId },
      { status: 403 },
    );
  }

  const result = await digitalAssetProcessingService.processDueJobs();
  return apiSuccess(result, { requestId });
}

/** Worker or external scheduler entry point. Hobby Vercel cron uses `/api/cron/daily`. */
export async function GET(request: NextRequest) {
  return handleProcessDue(request);
}

export async function POST(request: NextRequest) {
  return handleProcessDue(request);
}
