import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withIntegrationsRead,
} from "@/lib/api/integrations-handler";
import { providerSyncService } from "@/server/services/provider-sync-service";

type Params = { params: Promise<{ resourceId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { resourceId: connectionId } = await params;
  const organisationId = requireOrganisationId(request);

  return withIntegrationsRead(request, organisationId, async ({ requestId, tenant }) => {
    const failures = await providerSyncService.listFailures(tenant!, connectionId);
    return apiSuccess({ failures }, { requestId });
  });
}
