import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withCampaignRead,
  withCampaignUpdate,
} from "@/lib/api/campaigns-handler";
import { campaignChannelCreateSchema } from "@/lib/validation/campaigns";
import { campaignService } from "@/server/services/campaign-service";

type Params = { params: Promise<{ campaignId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { campaignId } = await params;
  const organisationId = requireOrganisationId(request);

  return withCampaignRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { channels: await campaignService.listChannels(campaignId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { campaignId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(campaignChannelCreateSchema, await jsonBody(request));

  return withCampaignUpdate(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        channel: await campaignService.addChannel(
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
