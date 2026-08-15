import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withIntegrationsWrite,
} from "@/lib/api/integrations-handler";
import { runSyncSchema } from "@/lib/validation/integrations-sync";
import { providerSyncService } from "@/server/services/provider-sync-service";

type Params = { params: Promise<{ resourceId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { resourceId: connectionId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json().catch(() => ({}));

  return withIntegrationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(runSyncSchema, body);
    const result = await providerSyncService.runSync(tenant!, connectionId, {
      syncMode: input.syncMode,
      resourceTypes: input.resourceTypes,
      dateRange:
        input.dateRangeStart && input.dateRangeEnd
          ? { start: new Date(input.dateRangeStart), end: new Date(input.dateRangeEnd) }
          : undefined,
    });
    return apiSuccess(result, { requestId });
  });
}
