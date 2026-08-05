import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withCampaignRead,
} from "@/lib/api/campaigns-handler";
import { campaignActivityListSchema } from "@/lib/validation/campaigns";
import { campaignService } from "@/server/services/campaign-service";

type Params = { params: Promise<{ campaignId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { campaignId } = await params;
  const organisationId = requireOrganisationId(request);
  const filters = parseBody(
    campaignActivityListSchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  return withCampaignRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await campaignService.listActivity(campaignId, organisationId, filters, tenant!),
      { requestId },
    ),
  );
}
