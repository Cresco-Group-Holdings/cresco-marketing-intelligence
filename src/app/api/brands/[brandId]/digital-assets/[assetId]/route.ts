import { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { digitalAssetService } from "@/server/services";
import { digitalAssetBulkArchiveSchema, digitalAssetUpdateSchema } from "@/lib/validation/digital-assets";
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
    const asset = await digitalAssetService.getById(brandId, organisationId, assetId, tenant!);
    return apiSuccess({ asset });
  });
}

export async function PUT(request: NextRequest, { params }: BrandAssetParams) {
  const { brandId, assetId } = await params;
  const organisationId = requireOrganisationId(request);

  return withDigitalAssetsWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(digitalAssetUpdateSchema, await jsonBody(request));
    const asset = await digitalAssetService.update(
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

export async function POST(request: NextRequest, { params }: BrandAssetParams) {
  const { brandId, assetId } = await params;
  const organisationId = requireOrganisationId(request);
  const action = new URL(request.url).searchParams.get("action");

  return withDigitalAssetsWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    if (action === "archive") {
      const asset = await digitalAssetService.archive(brandId, organisationId, assetId, tenant!, requestId);
      return apiSuccess({ asset }, { requestId });
    }
    if (action === "restore") {
      const asset = await digitalAssetService.restore(brandId, organisationId, assetId, tenant!, requestId);
      return apiSuccess({ asset }, { requestId });
    }
    if (action === "replace-version") {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        throw new AppError("VALIDATION_ERROR", "File is required.");
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const asset = await digitalAssetService.replaceVersion(
        brandId,
        organisationId,
        assetId,
        { filename: file.name, buffer },
        tenant!,
        requestId,
      );
      return apiSuccess({ asset }, { requestId });
    }
    throw new AppError("VALIDATION_ERROR", "Unknown action.");
  });
}
