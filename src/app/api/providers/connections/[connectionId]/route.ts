import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withProviderConnectionsAuthorize,
  withProviderConnectionsRead,
} from "@/lib/api/providers-handler";
import { providerConnectionService } from "@/server/services/provider-connection-service";
import { providerOAuthService } from "@/server/services/provider-oauth-service";
import { getServerEnv } from "@/lib/environment";

type Params = { params: Promise<{ connectionId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { connectionId } = await params;
  const organisationId = requireOrganisationId(request);

  return withProviderConnectionsRead(request, organisationId, async ({ requestId, tenant }) => {
    const connection = await providerConnectionService.getConnection(tenant!, connectionId);
    return apiSuccess({ connection }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { connectionId } = await params;
  const organisationId = requireOrganisationId(request);

  return withProviderConnectionsAuthorize(request, organisationId, async ({ requestId, tenant }) => {
    const body = (await request.json()) as { action: string; returnUrl?: string };
    const env = getServerEnv();
    const redirectUri = env.OAUTH_CALLBACK_BASE_URL ?? `${env.APP_URL}/api/providers/oauth/callback`;

    if (body.action === "authorize") {
      const result = await providerOAuthService.startAuthorization(tenant!, {
        connectionId,
        returnUrl: body.returnUrl,
        redirectUri,
      });
      return apiSuccess({ authorization: result }, { requestId });
    }

    if (body.action === "disconnect") {
      await providerConnectionService.disconnectConnection(tenant!, connectionId);
      return apiSuccess({ disconnected: true }, { requestId });
    }

    return apiSuccess({ error: "Unknown action" }, { requestId });
  });
}
