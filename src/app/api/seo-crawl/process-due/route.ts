import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAuthorisedWorkerRequest } from "@/lib/api/worker-auth";
import { apiSuccess } from "@/lib/api/response";
import { getSeoCrawlConfig } from "@/lib/seo/config";
import { seoCrawlService } from "@/server/services/seo-crawl-service";

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  if (!isAuthorisedWorkerRequest(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Worker authorization failed." }, requestId },
      { status: 403 },
    );
  }
  const config = getSeoCrawlConfig();
  const requested = Number(request.nextUrl.searchParams.get("limit"));
  const limit =
    Number.isFinite(requested) && requested > 0 ? requested : config.maxCrawlsPerWorkerRun;
  return apiSuccess(
    { results: await seoCrawlService.processDue(limit, `worker-${requestId}`) },
    { requestId },
  );
}
