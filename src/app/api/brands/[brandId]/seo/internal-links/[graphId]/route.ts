import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withInternalLinksPropose, withInternalLinksRead } from "@/lib/api/internal-links-handler";
import { proposalActionSchema } from "@/lib/validation/internal-links";
import { internalLinkBuildService } from "@/server/services/internal-link-build-service";
import { internalLinkGraphService } from "@/server/services/internal-link-graph-service";
import { internalLinkProposalService } from "@/server/services/internal-link-proposal-service";

type Params = { params: Promise<{ brandId: string; graphId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, graphId } = await params;
  const organisationId = requireOrganisationId(request);
  const view = request.nextUrl.searchParams.get("view");

  if (view === "orphans") {
    return withInternalLinksRead(request, organisationId, async ({ requestId, tenant }) =>
      apiSuccess({ orphans: await internalLinkGraphService.getOrphans(graphId, brandId, organisationId, tenant!) }, { requestId }),
    );
  }

  if (view === "visualization") {
    return withInternalLinksRead(request, organisationId, async ({ requestId, tenant }) =>
      apiSuccess(await internalLinkBuildService.getVisualization(graphId, brandId, organisationId, tenant!), { requestId }),
    );
  }

  return withInternalLinksRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ graph: await internalLinkGraphService.getById(graphId, brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, graphId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withInternalLinksPropose(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(proposalActionSchema, body);
    const proposal = await internalLinkProposalService.createProposal(graphId, brandId, organisationId, input, tenant!);
    return apiSuccess({ proposal }, { requestId });
  });
}
