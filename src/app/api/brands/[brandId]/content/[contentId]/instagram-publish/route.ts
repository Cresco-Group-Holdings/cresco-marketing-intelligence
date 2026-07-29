import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withContentPublish } from "@/lib/api/content-handler";
import { instagramImmediatePublishSchema } from "@/lib/validation/instagram-publishing";
import { instagramPublishingService } from "@/server/services/instagram-publishing-service";

type Params = { params: Promise<{ brandId: string; contentId: string }> };
export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(instagramImmediatePublishSchema, await jsonBody(request));
  return withContentPublish(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ job: await instagramPublishingService.enqueueImmediatePublish(brandId, organisationId, contentId, body, tenant!) }, { requestId }),
  );
}
