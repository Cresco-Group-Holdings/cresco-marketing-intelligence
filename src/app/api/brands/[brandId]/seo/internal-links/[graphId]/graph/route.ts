import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withInternalLinksRead } from "@/lib/api/internal-links-handler";
import { internalLinkBuildService } from "@/server/services/internal-link-build-service";

type Params = { params: Promise<{ brandId: string; graphId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, graphId } = await params;
  const organisationId = requireOrganisationId(request);
  return withInternalLinksRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await internalLinkBuildService.getVisualization(graphId, brandId, organisationId, tenant!),
      { requestId },
    ),
  );
}
