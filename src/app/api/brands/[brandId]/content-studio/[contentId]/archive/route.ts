import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withContentArchive,
} from "@/lib/api/content-handler";
import { contentStudioService } from "@/server/services/content-studio-service";

type Params = { params: Promise<{ brandId: string; contentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);

  return withContentArchive(request, organisationId, async ({ requestId, tenant }) => {
    const result = await contentStudioService.archive(
      brandId,
      organisationId,
      contentId,
      tenant!,
      requestId,
    );
    return apiSuccess(result, { requestId });
  });
}
