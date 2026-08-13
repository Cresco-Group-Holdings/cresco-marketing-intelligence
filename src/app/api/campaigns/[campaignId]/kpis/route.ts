import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withCampaignManageKpis,
  withCampaignRead,
} from "@/lib/api/campaigns-handler";
import { campaignKpiCreateSchema } from "@/lib/validation/campaigns";
import { campaignService } from "@/server/services/campaign-service";

type Params = { params: Promise<{ campaignId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { campaignId } = await params;
  const organisationId = requireOrganisationId(request);

  return withCampaignRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { kpis: await campaignService.listKpis(campaignId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { campaignId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(campaignKpiCreateSchema, await jsonBody(request));

  return withCampaignManageKpis(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        kpi: await campaignService.addKpi(
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
