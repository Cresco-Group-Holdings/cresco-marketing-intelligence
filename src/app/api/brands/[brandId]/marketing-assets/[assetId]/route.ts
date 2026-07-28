import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withMarketingAssetsRead,
  withMarketingAssetsWrite,
} from "@/lib/api/marketing-assets-handler";
import { marketingAssetUpdateSchema } from "@/lib/validation/marketing-assets";
import { marketingAssetService } from "@/server/services";

type Params = { params: Promise<{ brandId: string; assetId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, assetId } = await params;
  const organisationId = requireOrganisationId(request);

  return withMarketingAssetsRead(request, organisationId, async ({ requestId, tenant }) => {
    const asset = await marketingAssetService.getById(brandId, organisationId, assetId, tenant!);
    return apiSuccess({ asset }, { requestId });
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { brandId, assetId } = await params;
  const organisationId = requireOrganisationId(request);

  return withMarketingAssetsWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(marketingAssetUpdateSchema, await jsonBody(request));
    const asset = await marketingAssetService.update(
      brandId,
      organisationId,
      assetId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess({ asset }, { requestId });
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { brandId, assetId } = await params;
  const organisationId = requireOrganisationId(request);

  return withMarketingAssetsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const asset = await marketingAssetService.archive(brandId, organisationId, assetId, tenant!, requestId);
    return apiSuccess({ asset }, { requestId });
  });
}
