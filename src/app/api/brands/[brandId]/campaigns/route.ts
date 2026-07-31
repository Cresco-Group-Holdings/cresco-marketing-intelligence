import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  operationsFilters,
  requireOrganisationId,
  withOperationsRead,
  withOperationsWrite,
} from "@/lib/api/operations-handler";
import { campaignCreateSchema } from "@/lib/validation/operations";
import { contentOperationsService } from "@/server/services/content-operations-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);

  return withOperationsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(await contentOperationsService.listCampaigns(brandId, organisationId, tenant!), {
      requestId,
    }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(campaignCreateSchema, await jsonBody(request));

  return withOperationsWrite(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await contentOperationsService.createCampaign(brandId, organisationId, body, tenant!),
      { requestId },
    ),
  );
}
