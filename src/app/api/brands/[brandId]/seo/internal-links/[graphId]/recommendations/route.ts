import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withInternalLinksRead } from "@/lib/api/internal-links-handler";
import { internalLinkGraphService } from "@/server/services/internal-link-graph-service";

type Params = { params: Promise<{ brandId: string; graphId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, graphId } = await params;
  const organisationId = requireOrganisationId(request);
  return withInternalLinksRead(request, organisationId, async ({ requestId, tenant }) => {
    const graph = await internalLinkGraphService.getById(graphId, brandId, organisationId, tenant!);
    return apiSuccess({ recommendations: graph.recommendations }, { requestId });
  });
}
