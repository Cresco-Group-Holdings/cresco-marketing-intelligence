import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withContentRead,
} from "@/lib/api/content-handler";
import { contentStudioService } from "@/server/services/content-studio-service";

type Params = { params: Promise<{ brandId: string; contentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);

  return withContentRead(request, organisationId, async ({ requestId, tenant }) => {
    const versions = await contentStudioService.getVersionHistory(
      brandId,
      organisationId,
      contentId,
      tenant!,
    );
    return apiSuccess({ versions }, { requestId });
  });
}
