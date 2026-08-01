import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withProviderConnectionsAuthorize,
} from "@/lib/api/providers-handler";
import { providerResendConnectionService } from "@/server/services/provider-resend-connection-service";

type Params = { params: Promise<{ connectionId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { connectionId } = await params;
  const organisationId = requireOrganisationId(request);

  return withProviderConnectionsAuthorize(request, organisationId, async ({ requestId, tenant }) => {
    await providerResendConnectionService.revokeConnection(tenant!, connectionId);
    return apiSuccess({ revoked: true }, { requestId });
  });
}
