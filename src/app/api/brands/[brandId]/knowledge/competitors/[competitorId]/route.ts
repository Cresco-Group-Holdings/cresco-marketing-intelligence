import { NextRequest } from "next/server";
import { brandKnowledgeService } from "@/server/services";
import { brandCompetitorUpdateSchema } from "@/lib/validation/brand-knowledge";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  requireOrganisationId,
  withBrandKnowledgeWrite,
} from "@/lib/api/brand-knowledge-handler";

type Params = { params: Promise<{ brandId: string; competitorId: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { brandId, competitorId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBrandKnowledgeWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(brandCompetitorUpdateSchema, await jsonBody(request));
    const competitor = await brandKnowledgeService.competitors.update(brandId, organisationId, competitorId, body, tenant!, requestId);
    return apiSuccess({ competitor }, { requestId });
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { brandId, competitorId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBrandKnowledgeWrite(request, organisationId, async ({ requestId, tenant }) => {
    const competitor = await brandKnowledgeService.competitors.archive(brandId, organisationId, competitorId, tenant!, requestId);
    return apiSuccess({ competitor }, { requestId });
  });
}
