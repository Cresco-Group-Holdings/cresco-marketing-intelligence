import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  campaignListFilters,
  requireOrganisationId,
  withCampaignCreate,
  withCampaignRead,
} from "@/lib/api/campaigns-handler";
import { campaignCreateSchema } from "@/lib/validation/campaigns";
import { campaignService } from "@/server/services/campaign-service";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const filters = campaignListFilters(request);

  return withCampaignRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(await campaignService.list(organisationId, filters, tenant!), { requestId }),
  );
}

export async function POST(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const body = parseBody(campaignCreateSchema, await jsonBody(request));

  return withCampaignCreate(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { campaign: await campaignService.create(organisationId, body, tenant!, requestId) },
      { requestId },
    ),
  );
}
