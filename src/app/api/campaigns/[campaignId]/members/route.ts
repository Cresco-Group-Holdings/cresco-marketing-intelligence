import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withCampaignManageMembers,
  withCampaignRead,
} from "@/lib/api/campaigns-handler";
import { campaignMemberCreateSchema } from "@/lib/validation/campaigns";
import { campaignService } from "@/server/services/campaign-service";

type Params = { params: Promise<{ campaignId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { campaignId } = await params;
  const organisationId = requireOrganisationId(request);

  return withCampaignRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { members: await campaignService.listMembers(campaignId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { campaignId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(campaignMemberCreateSchema, await jsonBody(request));

  return withCampaignManageMembers(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        member: await campaignService.addMember(
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
