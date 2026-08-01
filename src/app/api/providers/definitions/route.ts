import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withProviderConnectionsRead,
} from "@/lib/api/providers-handler";
import { listProviderDefinitions } from "@/lib/providers/registry";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);

  return withProviderConnectionsRead(request, organisationId, async ({ requestId }) => {
    const definitions = listProviderDefinitions().map((definition) => ({
      key: definition.key,
      displayName: definition.displayName,
      category: definition.category,
      authType: definition.authType,
      capabilities: definition.capabilities,
      enabled: definition.enabled,
      webhookSupport: definition.webhookSupport,
      documentationUrl: definition.documentationUrl,
    }));
    return apiSuccess({ definitions }, { requestId });
  });
}
