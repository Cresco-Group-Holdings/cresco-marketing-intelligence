import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withSeoSitesRead } from "@/lib/api/seo-handler";
import { seoCrawlService } from "@/server/services/seo-crawl-service";

type Params = { params: Promise<{ brandId: string; runId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, runId } = await params;
  const organisationId = requireOrganisationId(request);
  return withSeoSitesRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { run: await seoCrawlService.getRun(runId, brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}
