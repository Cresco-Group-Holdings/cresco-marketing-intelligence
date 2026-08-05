import { NextRequest } from "next/server";
import { knowledgeBaseService } from "@/server/services";
import { knowledgeBaseCreateSchema } from "@/lib/validation/knowledge-base";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  requireOrganisationId,
  withKnowledgeBaseRead,
  withKnowledgeBaseWrite,
  type BrandParams,
} from "@/lib/api/knowledge-base-handler";

export async function GET(request: NextRequest, { params }: BrandParams) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);

  return withKnowledgeBaseRead(request, organisationId, async ({ tenant }) => {
    await knowledgeBaseService.ensureDefaultForBrand(brandId, organisationId, tenant!);
    const knowledgeBases = await knowledgeBaseService.bases.list(brandId, organisationId, tenant!);
    return apiSuccess({ knowledgeBases });
  });
}

export async function POST(request: NextRequest, { params }: BrandParams) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);

  return withKnowledgeBaseWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(knowledgeBaseCreateSchema, await jsonBody(request));
    const knowledgeBase = await knowledgeBaseService.bases.create(
      brandId,
      organisationId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess({ knowledgeBase }, { requestId });
  });
}
