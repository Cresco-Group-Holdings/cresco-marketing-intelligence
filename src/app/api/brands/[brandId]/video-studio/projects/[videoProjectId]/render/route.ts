import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withVideoStudioWrite } from "@/lib/api/video-studio-handler";
import { renderRequestSchema } from "@/lib/validation/video-studio";
import { videoStudioService } from "@/server/services/video-studio-service";
type Params = { params: Promise<{ brandId: string; videoProjectId: string }> };
export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, videoProjectId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(renderRequestSchema, await jsonBody(request));
  return withVideoStudioWrite(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        job: await videoStudioService.enqueueRender(
          brandId,
          organisationId,
          videoProjectId,
          body.idempotencyKey,
          tenant!,
          body.attachToContentVariantId,
        ),
      },
      { requestId },
    ),
  );
}
