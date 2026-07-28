import { NextRequest } from "next/server";
import { brandKnowledgeService } from "@/server/services";
import { brandOfferUpdateSchema } from "@/lib/validation/brand-knowledge";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  requireOrganisationId,
  withBrandKnowledgeWrite,
} from "@/lib/api/brand-knowledge-handler";

type Params = { params: Promise<{ brandId: string; offerId: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { brandId, offerId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBrandKnowledgeWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(brandOfferUpdateSchema, await jsonBody(request));
    const offer = await brandKnowledgeService.offers.update(brandId, organisationId, offerId, body, tenant!, requestId);
    return apiSuccess({ offer }, { requestId });
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { brandId, offerId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBrandKnowledgeWrite(request, organisationId, async ({ requestId, tenant }) => {
    const offer = await brandKnowledgeService.offers.archive(brandId, organisationId, offerId, tenant!, requestId);
    return apiSuccess({ offer }, { requestId });
  });
}
