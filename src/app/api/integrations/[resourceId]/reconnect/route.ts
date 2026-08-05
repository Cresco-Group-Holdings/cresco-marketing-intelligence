import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withIntegrationsAuthorize,
} from "@/lib/api/integrations-handler";
import { reconnectSchema } from "@/lib/validation/integrations";
import { integrationsConnectionService } from "@/server/services/integrations-connection-service";

type Params = { params: Promise<{ resourceId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { resourceId: connectionId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json().catch(() => ({}));

  return withIntegrationsAuthorize(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(reconnectSchema, body);
    const result = await integrationsConnectionService.reconnect(tenant!, connectionId, input.returnPath);
    return apiSuccess(result, { requestId });
  });
}
