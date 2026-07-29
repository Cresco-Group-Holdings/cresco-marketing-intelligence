import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { requireOrganisationId, withContentRead } from "@/lib/api/content-handler";
import { AppError } from "@/lib/errors";
import { tikTokPublishingService } from "@/server/services/tiktok-publishing-service";

type Params = { params: Promise<{ brandId: string; contentId: string }> };

/** Prepared manual-handoff package used when direct publishing is unavailable. */
export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const contentVariantId = request.nextUrl.searchParams.get("contentVariantId");
  if (!contentVariantId) throw new AppError("VALIDATION_ERROR", "contentVariantId is required.");

  return withContentRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await tikTokPublishingService.getFallbackPackage(
        brandId,
        organisationId,
        contentVariantId,
        tenant!,
      ),
      {
        requestId,
      },
    ),
  );
}
