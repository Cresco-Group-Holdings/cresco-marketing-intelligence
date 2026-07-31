import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import {
  requireOrganisationId,
  withSeoCrawlsCancel,
  withSeoCrawlsRun,
  withSeoSitesRead,
} from "@/lib/api/seo-handler";
import { parseBody } from "@/lib/api/handler";
import { startCrawlSchema } from "@/lib/validation/seo";
import { seoCrawlService } from "@/server/services/seo-crawl-service";

type Params = { params: Promise<{ brandId: string; siteId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, siteId } = await params;
  const organisationId = requireOrganisationId(request);
  return withSeoSitesRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { runs: await seoCrawlService.listRuns(siteId, brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, siteId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json().catch(() => ({}));
  return withSeoCrawlsRun(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(startCrawlSchema, body);
    const run = await seoCrawlService.enqueue(
      siteId,
      brandId,
      organisationId,
      tenant!,
      input.idempotencyKey,
    );
    return apiSuccess({ run }, { requestId });
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const runId = request.nextUrl.searchParams.get("runId");
  if (!runId) {
    return apiSuccess({ error: "runId required" }, { requestId: randomUUID() });
  }
  return withSeoCrawlsCancel(request, organisationId, async ({ requestId, tenant }) => {
    const run = await seoCrawlService.cancel(runId, brandId, organisationId, tenant!);
    return apiSuccess({ run }, { requestId });
  });
}
