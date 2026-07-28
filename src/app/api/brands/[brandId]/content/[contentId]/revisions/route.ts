import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withContentRead,
} from "@/lib/api/content-handler";
import { contentService } from "@/server/services/content-service";

type Params = { params: Promise<{ brandId: string; contentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);

  return withContentRead(request, organisationId, async ({ requestId, tenant }) => {
    const revisions = await contentService.listRevisions(
      brandId,
      organisationId,
      contentId,
      tenant!,
    );
    return apiSuccess({ revisions }, { requestId });
  });
}
