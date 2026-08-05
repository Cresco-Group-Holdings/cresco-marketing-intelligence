import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withIntegrationsRead,
} from "@/lib/api/integrations-handler";
import { integrationsConnectionService } from "@/server/services/integrations-connection-service";

type Params = { params: Promise<{ resourceId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { resourceId: connectionId } = await params;
  const organisationId = requireOrganisationId(request);

  return withIntegrationsRead(request, organisationId, async ({ requestId, tenant }) => {
    const result = await integrationsConnectionService.getScopes(tenant!, connectionId);
    return apiSuccess(result, { requestId });
  });
}
