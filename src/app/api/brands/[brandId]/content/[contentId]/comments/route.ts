import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withContentRead,
} from "@/lib/api/content-handler";
import { contentCommentCreateSchema } from "@/lib/validation/content";
import { contentService } from "@/server/services/content-service";

type Params = { params: Promise<{ brandId: string; contentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(contentCommentCreateSchema, await jsonBody(request));

  return withContentRead(request, organisationId, async ({ requestId, tenant }) => {
    const comment = await contentService.addComment(
      brandId,
      organisationId,
      contentId,
      body.body,
      tenant!,
      body.contentVariantId,
      requestId,
    );
    return apiSuccess({ comment }, { requestId });
  });
}
