import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withContentPublish } from "@/lib/api/content-handler";
import { facebookPublishSchema } from "@/lib/validation/linkedin-facebook-publishing";
import { linkedInFacebookPublishingService } from "@/server/services/linkedin-facebook-publishing-service";
type Params = { params: Promise<{ brandId: string; contentId: string }> };
export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(facebookPublishSchema, await jsonBody(request));
  return withContentPublish(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        job: await linkedInFacebookPublishingService.enqueue(
          brandId,
          organisationId,
          contentId,
          {
            contentVariantId: body.contentVariantId,
            socialAccountId: body.socialAccountId,
            idempotencyKey: body.idempotencyKey,
            settings: {
              provider: "FACEBOOK",
              pageId: body.pageId,
              publishAsReel: body.publishAsReel,
            },
          },
          tenant!,
          requestId,
        ),
      },
      { requestId },
    ),
  );
}
