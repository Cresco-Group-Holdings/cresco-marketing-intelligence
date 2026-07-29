import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withContentPublish } from "@/lib/api/content-handler";
import { youtubePublishSchema } from "@/lib/validation/youtube-x-publishing";
import { youtubeXPublishingService } from "@/server/services/youtube-x-publishing-service";
type Params = { params: Promise<{ brandId: string; contentId: string }> };
export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(youtubePublishSchema, await jsonBody(request));
  return withContentPublish(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        job: await youtubeXPublishingService.enqueue(
          brandId,
          organisationId,
          contentId,
          body,
          "YOUTUBE",
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}
