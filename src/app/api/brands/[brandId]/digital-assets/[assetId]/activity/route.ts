import { NextRequest } from "next/server";
import { digitalAssetService } from "@/server/services";
import {
  apiSuccess,
  requireOrganisationId,
  withDigitalAssetsRead,
  type BrandAssetParams,
} from "@/lib/api/digital-assets-handler";

export async function GET(request: NextRequest, { params }: BrandAssetParams) {
  const { brandId, assetId } = await params;
  const organisationId = requireOrganisationId(request);

  return withDigitalAssetsRead(request, organisationId, async ({ tenant }) => {
    const activity = await digitalAssetService.listActivity(brandId, organisationId, assetId, tenant!);
    return apiSuccess({ activity });
  });
}
