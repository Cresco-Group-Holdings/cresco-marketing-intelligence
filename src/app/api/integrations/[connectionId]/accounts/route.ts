import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withIntegrationRead } from "@/lib/api/integration-handler";
import { integrationConnectionService } from "@/server/services/integration-connection-service";

type Params = { params: Promise<{ connectionId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { connectionId } = await params;
  const organisationId = requireOrganisationId(request);
  return withIntegrationRead(request, organisationId, async ({ requestId, tenant }) => {
    const accounts = await integrationConnectionService.listAccounts(
      connectionId,
      organisationId,
      tenant!,
    );
    return apiSuccess({ accounts }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { connectionId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withIntegrationRead(request, organisationId, async ({ requestId, tenant }) => {
    const account = await integrationConnectionService.selectAccount(
      connectionId,
      organisationId,
      body.accountId,
      tenant!,
    );
    return apiSuccess({ account }, { requestId });
  });
}
