import { NextRequest } from "next/server";
import { brandKnowledgeService } from "@/server/services";
import { brandAudienceCreateSchema } from "@/lib/validation/brand-knowledge";
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
    const audiences = await brandKnowledgeService.audiences.list(brandId, organisationId, tenant!);
    return apiSuccess({ audiences }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: BrandParams) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);

  return withBrandKnowledgeWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(brandAudienceCreateSchema, await jsonBody(request));
    const audience = await brandKnowledgeService.audiences.create(
      brandId,
      organisationId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess({ audience }, { requestId });
  });
}
