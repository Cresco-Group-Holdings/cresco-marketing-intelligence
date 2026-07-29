import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { requireOrganisationId, withContentPublish } from "@/lib/api/content-handler";
import { tikTokPublishingService } from "@/server/services/tiktok-publishing-service";

type Params = { params: Promise<{ brandId: string; jobId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, jobId } = await params;
  const organisationId = requireOrganisationId(request);
  return withContentPublish(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(await tikTokPublishingService.cancel(brandId, organisationId, jobId, tenant!), {
      requestId,
    }),
  );
}
