import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withIntegrationsRead,
  withIntegrationsWrite,
} from "@/lib/api/integrations-handler";
import { updateSyncConfigSchema } from "@/lib/validation/integrations-sync";
import { providerSyncService } from "@/server/services/provider-sync-service";

type Params = { params: Promise<{ connectionId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { connectionId } = await params;
  const organisationId = requireOrganisationId(request);

  return withIntegrationsRead(request, organisationId, async ({ requestId, tenant }) => {
    const config = await providerSyncService.getSyncConfig(tenant!, connectionId);
    return apiSuccess({ config }, { requestId });
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { connectionId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  return withIntegrationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(updateSyncConfigSchema, body);
    const config = await providerSyncService.updateSyncConfig(tenant!, connectionId, input);
    return apiSuccess({ config }, { requestId });
  });
}
