import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withIntegrationsRead,
} from "@/lib/api/integrations-handler";
import { providerSyncService } from "@/server/services/provider-sync-service";

type Params = { params: Promise<{ connectionId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { connectionId } = await params;
  const organisationId = requireOrganisationId(request);

  return withIntegrationsRead(request, organisationId, async ({ requestId, tenant }) => {
    const freshness = await providerSyncService.getFreshness(tenant!, connectionId);
    return apiSuccess(freshness, { requestId });
  });
}
