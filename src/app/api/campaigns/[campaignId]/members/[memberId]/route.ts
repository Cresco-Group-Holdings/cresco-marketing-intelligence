import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withCampaignManageMembers,
} from "@/lib/api/campaigns-handler";
import { campaignMemberUpdateSchema } from "@/lib/validation/campaigns";
import { campaignService } from "@/server/services/campaign-service";

type Params = { params: Promise<{ campaignId: string; memberId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { campaignId, memberId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(campaignMemberUpdateSchema, await jsonBody(request));

  return withCampaignManageMembers(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        member: await campaignService.updateMember(
          campaignId,
          memberId,
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
  const { campaignId, memberId } = await params;
  const organisationId = requireOrganisationId(request);

  return withCampaignManageMembers(request, organisationId, async ({ requestId, tenant }) => {
    await campaignService.removeMember(campaignId, memberId, organisationId, tenant!, requestId);
    return apiSuccess({ success: true }, { requestId });
  });
}
