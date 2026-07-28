import { NextRequest } from "next/server";
import { brandKnowledgeService } from "@/server/services";
import { brandPersonaCreateSchema } from "@/lib/validation/brand-knowledge";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  requireOrganisationId,
  withBrandKnowledgeRead,
  withBrandKnowledgeWrite,
  type BrandParams,
} from "@/lib/api/brand-knowledge-handler";

export async function GET(request: NextRequest, { params }: BrandParams) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBrandKnowledgeRead(request, organisationId, async ({ requestId, tenant }) => {
    const personas = await brandKnowledgeService.personas.list(brandId, organisationId, tenant!);
    return apiSuccess({ personas }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: BrandParams) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBrandKnowledgeWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(brandPersonaCreateSchema, await jsonBody(request));
    const persona = await brandKnowledgeService.personas.create(brandId, organisationId, body, tenant!, requestId);
    return apiSuccess({ persona }, { requestId });
  });
}
