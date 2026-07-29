import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { instagramPublishingService } from "@/server/services/instagram-publishing-service";
type Params = { params: Promise<{ jobId: string }> };
export async function POST(request: NextRequest, { params }: Params) {
  const { jobId } = await params;
  return withApiHandler(request, async ({ requestId }) =>
    apiSuccess({ result: await instagramPublishingService.process(jobId) }, { requestId }),
  );
}
