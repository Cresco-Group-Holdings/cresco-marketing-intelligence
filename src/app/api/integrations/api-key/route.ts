import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withIntegrationsWrite,
} from "@/lib/api/integrations-handler";
import { apiKeyCredentialSchema } from "@/lib/validation/integrations";
import { integrationsConnectionService } from "@/server/services/integrations-connection-service";

export async function POST(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  return withIntegrationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(apiKeyCredentialSchema, body);
    const result = await integrationsConnectionService.storeStaticCredential(tenant!, {
      providerKey: input.providerKey,
      credentialKind: "api_key",
      secret: input.apiKey,
      displayName: input.displayName,
      connectionId: input.connectionId,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    });
    return apiSuccess(result, { requestId });
  });
}
