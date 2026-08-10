import { NextRequest } from "next/server";
import { knowledgeBaseService } from "@/server/services";
import { knowledgeTagCreateSchema } from "@/lib/validation/knowledge-base";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  requireOrganisationId,
  withKnowledgeBaseRead,
  withKnowledgeBaseWrite,
  type BrandKbParams,
} from "@/lib/api/knowledge-base-handler";

export async function GET(request: NextRequest, { params }: BrandKbParams) {
  const { brandId, knowledgeBaseId } = await params;
  const organisationId = requireOrganisationId(request);

  return withKnowledgeBaseRead(request, organisationId, async ({ tenant }) => {
    const tags = await knowledgeBaseService.tags.list(
      brandId,
      organisationId,
      knowledgeBaseId,
      tenant!,
    );
    return apiSuccess({ tags });
  });
}

export async function POST(request: NextRequest, { params }: BrandKbParams) {
  const { brandId, knowledgeBaseId } = await params;
  const organisationId = requireOrganisationId(request);

  return withKnowledgeBaseWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(knowledgeTagCreateSchema, await jsonBody(request));
    const tag = await knowledgeBaseService.tags.create(
      brandId,
      organisationId,
      knowledgeBaseId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess({ tag }, { requestId });
  });
}
