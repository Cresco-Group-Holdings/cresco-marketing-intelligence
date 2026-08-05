import { NextRequest } from "next/server";
import { knowledgeBaseService } from "@/server/services";
import { knowledgeRetrievalSchema } from "@/lib/validation/knowledge-base";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  requireOrganisationId,
  withKnowledgeBaseRead,
  type BrandParams,
} from "@/lib/api/knowledge-base-handler";

export async function POST(request: NextRequest, { params }: BrandParams) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);

  return withKnowledgeBaseRead(request, organisationId, async ({ request, requestId }) => {
    const body = parseBody(knowledgeRetrievalSchema, await jsonBody(request));
    const result = await knowledgeBaseService.retrieve({
      workspaceId: body.workspaceId ?? organisationId,
      organisationId,
      projectId: body.projectId,
      brandId: body.brandId ?? brandId,
      campaignId: body.campaignId,
      query: body.query,
      entryTypes: body.entryTypes,
      approvedOnly: body.approvedOnly,
      limit: body.limit,
    });
    return apiSuccess(result, { requestId });
  });
}
