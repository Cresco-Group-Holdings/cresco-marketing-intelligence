import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { isAuthorisedWorkerRequest } from "@/lib/api/worker-auth";
import { processPublishingJob } from "@/server/services/publishing-worker";

type Params = { params: Promise<{ jobId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = randomUUID();

  if (!isAuthorisedWorkerRequest(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Worker authorization failed." }, requestId },
      { status: 403 },
    );
  }

  const { jobId } = await params;
  return apiSuccess({ result: await processPublishingJob(jobId) }, { requestId });
}
