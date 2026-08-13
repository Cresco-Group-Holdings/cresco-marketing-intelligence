import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { isAuthorisedSchedulerRequest } from "@/lib/api/worker-auth";
import { digitalAssetProcessingService } from "@/server/services/digital-asset-processing-service";

export async function POST(request: NextRequest) {
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
