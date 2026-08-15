import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withIntegrationsAuthorize,
} from "@/lib/api/integrations-handler";
import { integrationsConnectionService } from "@/server/services/integrations-connection-service";

type Params = { params: Promise<{ connectionId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { connectionId } = await params;
  const organisationId = requireOrganisationId(request);

  return withIntegrationsAuthorize(request, organisationId, async ({ requestId, tenant }) => {
    const result = await integrationsConnectionService.revoke(tenant!, connectionId);
    return apiSuccess(result, { requestId });
  });
}
