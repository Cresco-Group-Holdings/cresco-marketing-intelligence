import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withContentPublish } from "@/lib/api/content-handler";
import { tikTokPublishRequestSchema } from "@/lib/validation/tiktok-publishing";
import { tikTokPublishingService } from "@/server/services/tiktok-publishing-service";

type Params = { params: Promise<{ brandId: string; contentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(tikTokPublishRequestSchema, await jsonBody(request));
  return withContentPublish(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        job: await tikTokPublishingService.enqueuePublish(
          brandId,
          organisationId,
          contentId,
          body,
          tenant!,
          requestId,
        ),
      },
      { requestId },
    ),
  );
}
