import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withContentEdit,
} from "@/lib/api/content-handler";
import { contentStudioService } from "@/server/services/content-studio-service";

type Params = { params: Promise<{ brandId: string; contentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);

  return withContentEdit(request, organisationId, async ({ requestId, tenant }) => {
    const item = await contentStudioService.submitForReview(
      brandId,
      organisationId,
      contentId,
      tenant!,
      requestId,
    );
    return apiSuccess({ item }, { requestId });
  });
}
