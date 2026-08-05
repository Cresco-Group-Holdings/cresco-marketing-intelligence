import { NextRequest } from "next/server";
import { knowledgeBaseService } from "@/server/services";
import {
  apiSuccess,
  requireOrganisationId,
  withKnowledgeBaseRead,
  type BrandKbParams,
} from "@/lib/api/knowledge-base-handler";

export async function GET(request: NextRequest, { params }: BrandKbParams) {
  const { brandId, knowledgeBaseId } = await params;
  const organisationId = requireOrganisationId(request);

  return withKnowledgeBaseRead(request, organisationId, async ({ tenant }) => {
    const entries = await knowledgeBaseService.entries.list(
      brandId,
      organisationId,
      knowledgeBaseId,
      tenant!,
    );
    const documents = await knowledgeBaseService.documents.list(
      brandId,
      organisationId,
      knowledgeBaseId,
      tenant!,
    );
    const tags = await knowledgeBaseService.tags.list(
      brandId,
      organisationId,
      knowledgeBaseId,
      tenant!,
    );
    const approvalQueue = await knowledgeBaseService.entries.listApprovalQueue(
      brandId,
      organisationId,
      knowledgeBaseId,
      tenant!,
    );

    return apiSuccess({
      summary: {
        entryCount: entries.length,
        documentCount: documents.length,
        tagCount: tags.length,
        pendingApprovals: approvalQueue.length,
      },
    });
  });
}
