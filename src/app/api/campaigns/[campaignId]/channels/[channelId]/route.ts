import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withCampaignUpdate,
} from "@/lib/api/campaigns-handler";
import { campaignChannelUpdateSchema } from "@/lib/validation/campaigns";
import { campaignService } from "@/server/services/campaign-service";

type Params = { params: Promise<{ campaignId: string; channelId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { campaignId, channelId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(campaignChannelUpdateSchema, await jsonBody(request));

  return withCampaignUpdate(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        channel: await campaignService.updateChannel(
          campaignId,
          channelId,
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

export async function DELETE(request: NextRequest, { params }: Params) {
  const { campaignId, channelId } = await params;
  const organisationId = requireOrganisationId(request);

  return withCampaignUpdate(request, organisationId, async ({ requestId, tenant }) => {
    await campaignService.removeChannel(campaignId, channelId, organisationId, tenant!, requestId);
    return apiSuccess({ success: true }, { requestId });
  });
}
