import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withContentPublish } from "@/lib/api/content-handler";
import { tikTokManualConfirmSchema } from "@/lib/validation/tiktok-publishing";
import { tikTokPublishingService } from "@/server/services/tiktok-publishing-service";

type Params = { params: Promise<{ brandId: string; jobId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, jobId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(tikTokManualConfirmSchema, await jsonBody(request));
  return withContentPublish(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        job: await tikTokPublishingService.confirmManualPublication(
          brandId,
          organisationId,
          jobId,
          body.publicUrl,
          tenant!,
          requestId,
        ),
      },
      { requestId },
    ),
  );
}
