import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withContentApprove,
} from "@/lib/api/content-handler";
import { contentApprovalDecisionSchema } from "@/lib/validation/content";
import { contentService } from "@/server/services/content-service";

type Params = { params: Promise<{ brandId: string; contentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(contentApprovalDecisionSchema, await jsonBody(request));

  return withContentApprove(request, organisationId, async ({ requestId, tenant }) => {
    const item = await contentService.approve(
      brandId,
      organisationId,
      contentId,
      tenant!,
      body.decisionNote,
      requestId,
    );
    return apiSuccess({ item }, { requestId });
  });
}
