import { NextRequest } from "next/server";
import { digitalAssetService } from "@/server/services";
import { digitalAssetBulkArchiveSchema } from "@/lib/validation/digital-assets";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  requireOrganisationId,
  withDigitalAssetsWrite,
  type BrandParams,
} from "@/lib/api/digital-assets-handler";

export async function POST(request: NextRequest, { params }: BrandParams) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);

  return withDigitalAssetsWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(digitalAssetBulkArchiveSchema, await jsonBody(request));
    const result = await digitalAssetService.bulkArchive(brandId, organisationId, body, tenant!, requestId);
    return apiSuccess(result, { requestId });
  });
}
