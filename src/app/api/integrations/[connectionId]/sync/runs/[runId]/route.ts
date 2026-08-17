import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withIntegrationsRead,
} from "@/lib/api/integrations-handler";
import { providerSyncService } from "@/server/services/provider-sync-service";

type Params = { params: Promise<{ connectionId: string; runId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { connectionId, runId } = await params;
  const organisationId = requireOrganisationId(request);

  return withIntegrationsRead(request, organisationId, async ({ requestId, tenant }) => {
    const run = await providerSyncService.getSyncRun(tenant!, connectionId, runId);
    return apiSuccess(
      {
        run: {
          id: run.id,
          status: run.status,
          syncMode: run.syncMode,
          recordsProcessed: run.recordsProcessed,
          recordsFailed: run.recordsFailed,
          partialFailure: run.partialFailure,
          failures: run.failures,
          startedAt: run.startedAt?.toISOString() ?? null,
          completedAt: run.completedAt?.toISOString() ?? null,
          errorMessage: run.errorMessage,
        },
      },
      { requestId },
    );
  });
}
