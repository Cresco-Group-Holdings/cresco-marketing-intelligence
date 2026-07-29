import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withOperationsRead,
  withOperationsWrite,
} from "@/lib/api/operations-handler";
import { campaignUpdateSchema } from "@/lib/validation/operations";
import { contentOperationsService } from "@/server/services/content-operations-service";

type Params = { params: Promise<{ brandId: string; campaignId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, campaignId } = await params;
  const organisationId = requireOrganisationId(request);

  return withOperationsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await contentOperationsService.getCampaign(brandId, organisationId, campaignId, tenant!),
      { requestId },
    ),
  );
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId, campaignId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(campaignUpdateSchema, await jsonBody(request));

  return withOperationsWrite(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await contentOperationsService.updateCampaign(
        brandId,
        organisationId,
        campaignId,
        body,
        tenant!,
      ),
      { requestId },
    ),
  );
}
