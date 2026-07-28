import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withSocialConnectionsRead,
} from "@/lib/api/social-handler";
import { ensureSocialAdaptersRegistered } from "@/lib/social/bootstrap";
import { socialConnectionService } from "@/server/services/social-connection-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  ensureSocialAdaptersRegistered();
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);

  return withSocialConnectionsRead(request, organisationId, async ({ requestId, tenant }) => {
    const catalogue = await socialConnectionService.getCatalogue(
      brandId,
      organisationId,
      tenant!,
    );
    return apiSuccess({ catalogue }, { requestId });
  });
}
