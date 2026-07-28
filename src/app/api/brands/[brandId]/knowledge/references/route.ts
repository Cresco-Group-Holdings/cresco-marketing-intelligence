import { NextRequest } from "next/server";
import { brandKnowledgeService } from "@/server/services";
import { brandReferenceCreateSchema } from "@/lib/validation/brand-knowledge";
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
    const references = await brandKnowledgeService.references.list(brandId, organisationId, tenant!);
    return apiSuccess({ references }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: BrandParams) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBrandKnowledgeWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(brandReferenceCreateSchema, await jsonBody(request));
    const reference = await brandKnowledgeService.references.create(brandId, organisationId, body, tenant!, requestId);
    return apiSuccess({ reference }, { requestId });
  });
}
