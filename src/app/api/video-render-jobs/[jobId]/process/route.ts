import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { videoStudioService } from "@/server/services/video-studio-service";

type Params = { params: Promise<{ jobId: string }> };

// Called by an authenticated worker deployment. Rendering is deliberately not performed
// by the user-facing enqueue request.
export async function POST(request: NextRequest, { params }: Params) {
  const { jobId } = await params;
  return withApiHandler(request, async ({ requestId }) =>
    apiSuccess({ result: await videoStudioService.processRenderJob(jobId) }, { requestId }),
  );
}
