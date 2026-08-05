import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { withProviderConnectionsRead } from "@/lib/api/providers-handler";
import { requireOrganisationId } from "@/lib/api/integration-handler";
import { integrationConnectionService } from "@/server/services/integration-connection-service";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  return withProviderConnectionsRead(request, organisationId, async ({ requestId }) => {
    const providers = integrationConnectionService.listProviders();
    return apiSuccess({ providers }, { requestId });
  });
}
