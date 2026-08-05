import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withProviderConnectionsRead,
} from "@/lib/api/providers-handler";
import { listProviderDefinitions } from "@/lib/providers/registry";
import { isResendProviderEnabled } from "@/lib/providers/resend-config";
import { isStage12OAuthProvider } from "@/lib/integrations/oauth/provider-definitions";
import { isStage12OAuthProviderEnabled } from "@/lib/integrations/oauth/stage12-config";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);

  return withProviderConnectionsRead(request, organisationId, async ({ requestId }) => {
    const definitions = listProviderDefinitions().map((definition) => ({
      key: definition.key,
      displayName: definition.displayName,
      category: definition.category,
      authType: definition.authType,
      capabilities: definition.capabilities,
      enabled:
        definition.key === "resend"
          ? isResendProviderEnabled()
          : isStage12OAuthProvider(definition.key)
            ? isStage12OAuthProviderEnabled(definition.key)
            : definition.enabled,
      webhookSupport: definition.webhookSupport,
      documentationUrl: definition.documentationUrl,
    }));
    return apiSuccess({ definitions }, { requestId });
  });
}
