import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withIntegrationsWrite,
} from "@/lib/api/integrations-handler";
import { serviceAccountCredentialSchema } from "@/lib/validation/integrations";
import { integrationsConnectionService } from "@/server/services/integrations-connection-service";

export async function POST(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  return withIntegrationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(serviceAccountCredentialSchema, body);
    const result = await integrationsConnectionService.storeStaticCredential(tenant!, {
      providerKey: input.providerKey,
      credentialKind: "service_account",
      secret: input.serviceAccountJson,
      displayName: input.displayName,
      connectionId: input.connectionId,
    });
    return apiSuccess(result, { requestId });
  });
}
