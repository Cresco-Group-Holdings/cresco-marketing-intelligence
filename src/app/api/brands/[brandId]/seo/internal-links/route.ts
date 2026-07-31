import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withInternalLinksBuild, withInternalLinksManage, withInternalLinksRead } from "@/lib/api/internal-links-handler";
import { buildGraphSchema } from "@/lib/validation/internal-links";
import { internalLinkGraphService } from "@/server/services/internal-link-graph-service";
import { internalLinkBuildService } from "@/server/services/internal-link-build-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withInternalLinksRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ items: await internalLinkGraphService.list(brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withInternalLinksBuild(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(buildGraphSchema, body);
    const graph = await internalLinkBuildService.buildGraph(
      brandId,
      organisationId,
      input.seoSiteId,
      tenant!,
      input.crawlRunId,
    );
    return apiSuccess({ graph }, { requestId });
  });
}
