import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withIntegrationSync } from "@/lib/api/integration-handler";
import { integrationConnectionService } from "@/server/services/integration-connection-service";

type Params = { params: Promise<{ connectionId: string; jobId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const organisationId = requireOrganisationId(request);
  return withIntegrationSync(request, organisationId, async ({ requestId }) => {
    const job = await integrationConnectionService.getSyncJob(jobId, organisationId);
    return apiSuccess({ job }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "cancel") {
    return withIntegrationSync(request, organisationId, async ({ requestId }) => {
      const job = await integrationConnectionService.cancelSyncJob(jobId, organisationId);
      return apiSuccess({ job }, { requestId });
    });
  }

  return withIntegrationSync(request, organisationId, async ({ requestId }) => {
    return apiSuccess({ jobId, action: body.action ?? "noop" }, { requestId });
  });
}
