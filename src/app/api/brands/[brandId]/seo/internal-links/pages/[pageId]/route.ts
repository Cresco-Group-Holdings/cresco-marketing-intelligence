import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withInternalLinksRead } from "@/lib/api/internal-links-handler";
import { internalLinkGraphService } from "@/server/services/internal-link-graph-service";

type Params = { params: Promise<{ brandId: string; pageId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, pageId } = await params;
  const organisationId = requireOrganisationId(request);
  const graphId = request.nextUrl.searchParams.get("graphId");
  if (!graphId) {
    return withInternalLinksRead(request, organisationId, async ({ requestId }) =>
      apiSuccess({ error: "graphId query parameter required" }, { requestId }),
    );
  }
  return withInternalLinksRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { page: await internalLinkGraphService.getPageDetail(graphId, pageId, brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}
