import { NextRequest } from "next/server";
import { knowledgeBaseService } from "@/server/services";
import {
  knowledgeEntryCreateSchema,
  knowledgeEntryListQuerySchema,
} from "@/lib/validation/knowledge-base";
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
  const url = new URL(request.url);
  const query = parseBody(knowledgeEntryListQuerySchema, {
    search: url.searchParams.get("search") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    sourceType: url.searchParams.get("sourceType") ?? undefined,
    campaignId: url.searchParams.get("campaignId") ?? undefined,
    tagId: url.searchParams.get("tagId") ?? undefined,
    includeArchived: url.searchParams.get("includeArchived") === "true",
  });

  return withKnowledgeBaseRead(request, organisationId, async ({ tenant }) => {
    const entries = await knowledgeBaseService.entries.list(
      brandId,
      organisationId,
      knowledgeBaseId,
      tenant!,
      query,
    );
    return apiSuccess({ entries });
  });
}

export async function POST(request: NextRequest, { params }: BrandKbParams) {
  const { brandId, knowledgeBaseId } = await params;
  const organisationId = requireOrganisationId(request);

  return withKnowledgeBaseWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(knowledgeEntryCreateSchema, await jsonBody(request));
    const entry = await knowledgeBaseService.entries.create(
      brandId,
      organisationId,
      knowledgeBaseId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess({ entry }, { requestId });
  });
}
