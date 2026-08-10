import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withCampaignRead,
  withCampaignUpdate,
} from "@/lib/api/campaigns-handler";
import { campaignUpdateSchema } from "@/lib/validation/campaigns";
import { campaignService } from "@/server/services/campaign-service";

type Params = { params: Promise<{ campaignId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { campaignId } = await params;
  const organisationId = requireOrganisationId(request);

  return withCampaignRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { campaign: await campaignService.getById(campaignId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { campaignId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(campaignUpdateSchema, await jsonBody(request));

  return withCampaignUpdate(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        campaign: await campaignService.update(
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
