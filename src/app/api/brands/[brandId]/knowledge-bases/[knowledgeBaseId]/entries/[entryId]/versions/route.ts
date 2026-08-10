import { NextRequest } from "next/server";
import { knowledgeBaseService } from "@/server/services";
import {
  apiSuccess,
  requireOrganisationId,
  withKnowledgeBaseRead,
  type BrandKbEntryParams,
} from "@/lib/api/knowledge-base-handler";

export async function GET(request: NextRequest, { params }: BrandKbEntryParams) {
  const { brandId, knowledgeBaseId, entryId } = await params;
  const organisationId = requireOrganisationId(request);

  return withKnowledgeBaseRead(request, organisationId, async ({ tenant }) => {
    const versions = await knowledgeBaseService.entries.listVersions(
      brandId,
      organisationId,
      knowledgeBaseId,
      entryId,
      tenant!,
    );
    return apiSuccess({ versions });
  });
}
