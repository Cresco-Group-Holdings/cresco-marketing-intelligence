import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAuthorisedWorkerRequest } from "@/lib/api/worker-auth";
import { apiSuccess } from "@/lib/api/response";
import { seoCrawlService } from "@/server/services/seo-crawl-service";

type Params = { params: Promise<{ runId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = randomUUID();
  if (!isAuthorisedWorkerRequest(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Worker authorization failed." }, requestId },
      { status: 403 },
    );
  }
  const { runId } = await params;
  return apiSuccess(
    { result: await seoCrawlService.process(runId, `worker-${requestId}`) },
    { requestId },
  );
}
