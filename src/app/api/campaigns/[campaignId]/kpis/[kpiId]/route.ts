import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withCampaignManageKpis,
} from "@/lib/api/campaigns-handler";
import { campaignKpiUpdateSchema } from "@/lib/validation/campaigns";
import { campaignService } from "@/server/services/campaign-service";

type Params = { params: Promise<{ campaignId: string; kpiId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { campaignId, kpiId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(campaignKpiUpdateSchema, await jsonBody(request));

  return withCampaignManageKpis(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        kpi: await campaignService.updateKpi(
          campaignId,
          kpiId,
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
  const { campaignId, kpiId } = await params;
  const organisationId = requireOrganisationId(request);

  return withCampaignManageKpis(request, organisationId, async ({ requestId, tenant }) => {
    await campaignService.removeKpi(campaignId, kpiId, organisationId, tenant!, requestId);
    return apiSuccess({ success: true }, { requestId });
  });
}
