import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withProviderConnectionsRead,
} from "@/lib/api/providers-handler";
import { providerResendConnectionService } from "@/server/services/provider-resend-connection-service";

type Params = { params: Promise<{ connectionId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { connectionId } = await params;
  const organisationId = requireOrganisationId(request);

  return withProviderConnectionsRead(request, organisationId, async ({ requestId, tenant }) => {
    const domains = await providerResendConnectionService.listDomains(tenant!, connectionId);
    return apiSuccess({ domains }, { requestId });
  });
}
