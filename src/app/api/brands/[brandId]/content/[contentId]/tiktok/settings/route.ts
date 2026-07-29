import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withContentEdit, withContentRead } from "@/lib/api/content-handler";
import { tikTokPublishSettingsSchema } from "@/lib/validation/tiktok-publishing";
import { tikTokPublishingService } from "@/server/services/tiktok-publishing-service";

type Params = { params: Promise<{ brandId: string; contentId: string }> };

/** Consent context: target account, preview, caption, and the creator's own options. */
export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const contentVariantId = request.nextUrl.searchParams.get("contentVariantId");
  if (!contentVariantId) {
    return withContentRead(request, organisationId, async ({ requestId }) =>
      apiSuccess({ error: "contentVariantId is required." }, { requestId }),
    );
  }
  return withContentRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await tikTokPublishingService.getConsentContext(
        brandId,
        organisationId,
        contentVariantId,
        tenant!,
      ),
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(tikTokPublishSettingsSchema, await jsonBody(request));
  return withContentEdit(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        settings: await tikTokPublishingService.savePublishSettings(
          brandId,
          organisationId,
          body,
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}
