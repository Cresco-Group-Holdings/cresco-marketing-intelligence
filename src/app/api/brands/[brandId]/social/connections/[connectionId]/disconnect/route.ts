import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withSocialConnectionsDisconnect,
} from "@/lib/api/social-handler";
import { ensureSocialAdaptersRegistered } from "@/lib/social/bootstrap";
import { socialConnectionService } from "@/server/services/social-connection-service";

type Params = { params: Promise<{ brandId: string; connectionId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  ensureSocialAdaptersRegistered();
  const { brandId, connectionId } = await params;
  const organisationId = requireOrganisationId(request);

  return withSocialConnectionsDisconnect(request, organisationId, async ({ requestId, tenant }) => {
    await socialConnectionService.disconnect(
      brandId,
      organisationId,
      connectionId,
      tenant!,
      requestId,
    );
    return apiSuccess({ disconnected: true }, { requestId });
  });
}
