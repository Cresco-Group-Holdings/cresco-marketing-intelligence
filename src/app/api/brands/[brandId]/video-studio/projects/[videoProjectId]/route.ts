import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { requireOrganisationId, withVideoStudioRead } from "@/lib/api/video-studio-handler";
import { videoStudioService } from "@/server/services/video-studio-service";
type Params = { params: Promise<{ brandId: string; videoProjectId: string }> };
export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, videoProjectId } = await params;
  const organisationId = requireOrganisationId(request);
  return withVideoStudioRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        project: await videoStudioService.getProject(
          brandId,
          organisationId,
          videoProjectId,
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}
