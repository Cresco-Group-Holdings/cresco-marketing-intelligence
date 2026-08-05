import { NextRequest } from "next/server";
import { knowledgeBaseService } from "@/server/services";
import { knowledgeRelationshipCreateSchema } from "@/lib/validation/knowledge-base";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  requireOrganisationId,
  withKnowledgeBaseRead,
  withKnowledgeBaseWrite,
  type BrandKbEntryParams,
  type BrandKbRelationshipParams,
} from "@/lib/api/knowledge-base-handler";

export async function GET(request: NextRequest, { params }: BrandKbEntryParams) {
  const { brandId, knowledgeBaseId, entryId } = await params;
  const organisationId = requireOrganisationId(request);

  return withKnowledgeBaseRead(request, organisationId, async ({ tenant }) => {
    const relationships = await knowledgeBaseService.relationships.list(
      brandId,
      organisationId,
      knowledgeBaseId,
      entryId,
      tenant!,
    );
    const conflicts = await knowledgeBaseService.entries.listConflicts(
      brandId,
      organisationId,
      knowledgeBaseId,
      entryId,
      tenant!,
    );
    return apiSuccess({ relationships, conflicts });
  });
}

export async function POST(request: NextRequest, { params }: BrandKbEntryParams) {
  const { brandId, knowledgeBaseId, entryId } = await params;
  const organisationId = requireOrganisationId(request);

  return withKnowledgeBaseWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(knowledgeRelationshipCreateSchema, await jsonBody(request));
    const relationship = await knowledgeBaseService.relationships.create(
      brandId,
      organisationId,
      knowledgeBaseId,
      entryId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess({ relationship }, { requestId });
  });
}

export async function DELETE(request: NextRequest, { params }: BrandKbRelationshipParams) {
  const { brandId, knowledgeBaseId, entryId, relationshipId } = await params;
  const organisationId = requireOrganisationId(request);

  return withKnowledgeBaseWrite(request, organisationId, async ({ requestId, tenant }) => {
    await knowledgeBaseService.relationships.remove(
      brandId,
      organisationId,
      knowledgeBaseId,
      entryId,
      relationshipId,
      tenant!,
      requestId,
    );
    return apiSuccess({ removed: true }, { requestId });
  });
}
