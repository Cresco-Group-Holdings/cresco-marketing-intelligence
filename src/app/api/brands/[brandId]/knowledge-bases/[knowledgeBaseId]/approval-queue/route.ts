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
    const queue = await knowledgeBaseService.entries.listApprovalQueue(
      brandId,
      organisationId,
      knowledgeBaseId,
      tenant!,
    );
    return apiSuccess({ queue });
  });
}
