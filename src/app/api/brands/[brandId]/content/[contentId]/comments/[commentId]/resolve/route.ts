import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withContentRead,
} from "@/lib/api/content-handler";
import { contentService } from "@/server/services/content-service";

type Params = {
  params: Promise<{ brandId: string; contentId: string; commentId: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, contentId, commentId } = await params;
  const organisationId = requireOrganisationId(request);

  return withContentRead(request, organisationId, async ({ requestId, tenant }) => {
    const comment = await contentService.resolveComment(
      brandId,
      organisationId,
      contentId,
      commentId,
      tenant!,
      requestId,
    );
    return apiSuccess({ comment }, { requestId });
  });
}
