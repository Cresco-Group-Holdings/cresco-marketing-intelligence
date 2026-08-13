import { NextRequest } from "next/server";
import { digitalAssetService } from "@/server/services";
import { digitalAssetUsageCreateSchema } from "@/lib/validation/digital-assets";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  requireOrganisationId,
  withDigitalAssetsRead,
  withDigitalAssetsWrite,
  type BrandAssetParams,
} from "@/lib/api/digital-assets-handler";

export async function GET(request: NextRequest, { params }: BrandAssetParams) {
  const { brandId, assetId } = await params;
  const organisationId = requireOrganisationId(request);

  return withDigitalAssetsRead(request, organisationId, async ({ tenant }) => {
    const usages = await digitalAssetService.usages.list(brandId, organisationId, assetId, tenant!);
    return apiSuccess({ usages });
  });
}

export async function POST(request: NextRequest, { params }: BrandAssetParams) {
  const { brandId, assetId } = await params;
  const organisationId = requireOrganisationId(request);

  return withDigitalAssetsWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(digitalAssetUsageCreateSchema, await jsonBody(request));
    const usage = await digitalAssetService.usages.record(
      brandId,
      organisationId,
      assetId,
      body,
      tenant!,
    );
    return apiSuccess({ usage }, { requestId });
  });
}
