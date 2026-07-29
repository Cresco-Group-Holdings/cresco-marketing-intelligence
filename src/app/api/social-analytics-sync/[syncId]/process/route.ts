import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { isAuthorisedWorkerRequest } from "@/lib/api/worker-auth";
import { socialAnalyticsSyncService } from "@/server/services/social-analytics-sync-service";
type Params = { params: Promise<{ syncId: string }> };
export async function POST(request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  if (!isAuthorisedWorkerRequest(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Worker authorization failed." }, requestId },
      { status: 403 },
    );
  }
  const { syncId } = await params;
  return apiSuccess(
    { result: await socialAnalyticsSyncService.process(syncId, `worker-${requestId}`) },
    { requestId },
  );
}
