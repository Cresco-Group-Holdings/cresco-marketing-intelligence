import { NextRequest } from "next/server";
import { knowledgeBaseService } from "@/server/services";
import {
  apiSuccess,
  requireOrganisationId,
  withKnowledgeBaseRead,
  type BrandKbDocParams,
} from "@/lib/api/knowledge-base-handler";

export async function GET(request: NextRequest, { params }: BrandKbDocParams) {
  const { brandId, knowledgeBaseId, documentId } = await params;
  const organisationId = requireOrganisationId(request);

  return withKnowledgeBaseRead(request, organisationId, async ({ tenant }) => {
    const signedUrl = await knowledgeBaseService.documents.getSignedUrl(
      brandId,
      organisationId,
      knowledgeBaseId,
      documentId,
      tenant!,
    );
    return apiSuccess({ signedUrl });
  });
}
