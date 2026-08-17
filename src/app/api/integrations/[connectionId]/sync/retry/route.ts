import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withIntegrationsWrite,
} from "@/lib/api/integrations-handler";
import { retryFailuresSchema } from "@/lib/validation/integrations-sync";
import { providerSyncService } from "@/server/services/provider-sync-service";

type Params = { params: Promise<{ connectionId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { connectionId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json().catch(() => ({}));

  return withIntegrationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(retryFailuresSchema, body);
    const result = await providerSyncService.retryFailures(tenant!, connectionId, input.failureIds);
    return apiSuccess(result, { requestId });
  });
}
