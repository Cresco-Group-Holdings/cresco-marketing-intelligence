import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withMarketingAssetsRead,
} from "@/lib/api/marketing-assets-handler";
import { marketingAssetService } from "@/server/services";

type Params = { params: Promise<{ brandId: string; assetId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, assetId } = await params;
  const organisationId = requireOrganisationId(request);

  return withMarketingAssetsRead(request, organisationId, async ({ requestId, tenant }) => {
    const signed = await marketingAssetService.createSignedAccessUrl(
      brandId,
      organisationId,
      assetId,
      tenant!,
      requestId,
    );
    return apiSuccess({ signedUrl: signed }, { requestId });
  });
}
