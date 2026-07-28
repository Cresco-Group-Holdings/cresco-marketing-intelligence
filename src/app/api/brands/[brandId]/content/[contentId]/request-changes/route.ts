import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withContentRequestChanges,
} from "@/lib/api/content-handler";
import { contentRequestChangesSchema } from "@/lib/validation/content";
import { contentService } from "@/server/services/content-service";

type Params = { params: Promise<{ brandId: string; contentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(contentRequestChangesSchema, await jsonBody(request));

  return withContentRequestChanges(request, organisationId, async ({ requestId, tenant }) => {
    const item = await contentService.requestChanges(
      brandId,
      organisationId,
      contentId,
      body.decisionNote,
      tenant!,
      requestId,
    );
    return apiSuccess({ item }, { requestId });
  });
}
