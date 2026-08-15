import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withIntegrationsAuthorize,
} from "@/lib/api/integrations-handler";
import { connectProviderSchema } from "@/lib/validation/integrations";
import { oauthAuthorizationService } from "@/server/services/oauth-authorization-service";

type Params = { params: Promise<{ providerKey: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { providerKey } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json().catch(() => ({}));

  return withIntegrationsAuthorize(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(connectProviderSchema, body);
    const result = await oauthAuthorizationService.startConnect(tenant!, {
      providerKey,
      ...input,
    });
    return apiSuccess(result, { requestId });
  });
}
