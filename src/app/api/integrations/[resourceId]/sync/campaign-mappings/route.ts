import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withIntegrationsRead,
  withIntegrationsWrite,
} from "@/lib/api/integrations-handler";
import { campaignMappingSchema } from "@/lib/validation/integrations-sync";
import { campaignMappingService } from "@/server/services/campaign-mapping-service";

type Params = { params: Promise<{ resourceId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { resourceId: connectionId } = await params;
  const organisationId = requireOrganisationId(request);

  return withIntegrationsRead(request, organisationId, async ({ requestId, tenant }) => {
    const mappings = await campaignMappingService.listCampaignMappings(tenant!, connectionId);
    return apiSuccess({ mappings }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { resourceId: connectionId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  return withIntegrationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(campaignMappingSchema, body);
    const mapping = await campaignMappingService.applyCampaignMapping(tenant!, connectionId, input);
    return apiSuccess({ mapping }, { requestId });
  });
}
