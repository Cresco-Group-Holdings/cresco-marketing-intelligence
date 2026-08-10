import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withCampaignTransition,
} from "@/lib/api/campaigns-handler";
import { campaignTransitionSchema } from "@/lib/validation/campaigns";
import { campaignService } from "@/server/services/campaign-service";

type Params = { params: Promise<{ campaignId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { campaignId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(campaignTransitionSchema, await jsonBody(request));

  return withCampaignTransition(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        campaign: await campaignService.transition(
          campaignId,
          organisationId,
          body,
          tenant!,
          requestId,
        ),
      },
      { requestId },
    ),
  );
}
