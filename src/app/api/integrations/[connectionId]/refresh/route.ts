import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withIntegrationsWrite,
} from "@/lib/api/integrations-handler";
import { integrationsConnectionService } from "@/server/services/integrations-connection-service";

type Params = { params: Promise<{ connectionId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { connectionId } = await params;
  const organisationId = requireOrganisationId(request);

  return withIntegrationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const result = await integrationsConnectionService.refresh(tenant!, connectionId);
    return apiSuccess(result, { requestId });
  });
}
