import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withVideoStudioWrite } from "@/lib/api/video-studio-handler";
import { videoProjectCreateSchema } from "@/lib/validation/video-studio";
import { videoStudioService } from "@/server/services/video-studio-service";

type Params = { params: Promise<{ brandId: string }> };
export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(videoProjectCreateSchema, await jsonBody(request));
  return withVideoStudioWrite(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { project: await videoStudioService.createProject(brandId, organisationId, body, tenant!) },
      { requestId },
    ),
  );
}
