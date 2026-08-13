import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withIntegrationSync } from "@/lib/api/integration-handler";
import { integrationConnectionService } from "@/server/services/integration-connection-service";

type Params = { params: Promise<{ connectionId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { connectionId } = await params;
  const organisationId = requireOrganisationId(request);
  return withIntegrationSync(request, organisationId, async ({ requestId }) => {
    const jobs = await integrationConnectionService.listSyncJobs(connectionId, organisationId);
    return apiSuccess({ jobs }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { connectionId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withIntegrationSync(request, organisationId, async ({ requestId, tenant }) => {
    const job = await integrationConnectionService.startSync(
      connectionId,
      organisationId,
      {
        capability: body.capability,
        resourceType: body.resourceType ?? body.capability,
        idempotencyKey: body.idempotencyKey,
      },
      tenant!,
    );
    return apiSuccess({ job }, { requestId });
  });
}
