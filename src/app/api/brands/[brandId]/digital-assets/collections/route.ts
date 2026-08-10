import { NextRequest } from "next/server";
import { digitalAssetService } from "@/server/services";
import { digitalAssetCollectionCreateSchema } from "@/lib/validation/digital-assets";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  requireOrganisationId,
  withDigitalAssetsRead,
  withDigitalAssetsWrite,
  type BrandParams,
} from "@/lib/api/digital-assets-handler";

export async function GET(request: NextRequest, { params }: BrandParams) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);

  return withDigitalAssetsRead(request, organisationId, async ({ tenant }) => {
    const collections = await digitalAssetService.collections.list(brandId, organisationId, tenant!);
    return apiSuccess({ collections });
  });
}

export async function POST(request: NextRequest, { params }: BrandParams) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);

  return withDigitalAssetsWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(digitalAssetCollectionCreateSchema, await jsonBody(request));
    const collection = await digitalAssetService.collections.create(
      brandId,
      organisationId,
      body,
      tenant!,
    );
    return apiSuccess({ collection }, { requestId });
  });
}
