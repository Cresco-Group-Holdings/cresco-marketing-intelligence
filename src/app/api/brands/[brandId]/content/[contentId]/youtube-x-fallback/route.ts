import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { requireOrganisationId, withContentRead } from "@/lib/api/content-handler";
import { AppError } from "@/lib/errors";
import { youtubeXPublishingService } from "@/server/services/youtube-x-publishing-service";
type Params = { params: Promise<{ brandId: string; contentId: string }> };
export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const variantId = request.nextUrl.searchParams.get("contentVariantId");
  if (!variantId) throw new AppError("VALIDATION_ERROR", "contentVariantId is required.");
  return withContentRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await youtubeXPublishingService.getFallbackPackage(
        brandId,
        organisationId,
        variantId,
        tenant!,
      ),
      { requestId },
    ),
  );
}
