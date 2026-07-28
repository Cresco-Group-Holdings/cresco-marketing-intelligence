import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withSocialConnectionsRead,
} from "@/lib/api/social-handler";
import { ensureSocialAdaptersRegistered } from "@/lib/social/bootstrap";
import { socialConnectionService } from "@/server/services/social-connection-service";

type Params = { params: Promise<{ brandId: string; connectionId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  ensureSocialAdaptersRegistered();
  const { brandId, connectionId } = await params;
  const organisationId = requireOrganisationId(request);

  return withSocialConnectionsRead(request, organisationId, async ({ requestId, tenant }) => {
    const accounts = await socialConnectionService.getPendingAccounts(
      brandId,
      organisationId,
      connectionId,
      tenant!,
    );
    return apiSuccess({ accounts }, { requestId });
  });
}
