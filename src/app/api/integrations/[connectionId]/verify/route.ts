import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withIntegrationVerify } from "@/lib/api/integration-handler";
import { integrationConnectionService } from "@/server/services/integration-connection-service";

type Params = { params: Promise<{ connectionId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { connectionId } = await params;
  const organisationId = requireOrganisationId(request);
  return withIntegrationVerify(request, organisationId, async ({ requestId, tenant }) => {
    const health = await integrationConnectionService.verifyConnection(
      connectionId,
      organisationId,
      tenant!,
    );
    return apiSuccess({ health }, { requestId });
  });
}
