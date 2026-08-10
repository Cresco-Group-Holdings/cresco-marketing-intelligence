import { NextRequest } from "next/server";
import { digitalAssetService } from "@/server/services";
import { digitalAssetListQuerySchema } from "@/lib/validation/digital-assets";
import {
  apiSuccess,
  parseBody,
  requireOrganisationId,
  withDigitalAssetsRead,
  type BrandParams,
} from "@/lib/api/digital-assets-handler";

export async function GET(request: NextRequest, { params }: BrandParams) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const url = new URL(request.url);

  const query = parseBody(digitalAssetListQuerySchema, {
    search: url.searchParams.get("search") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    campaignId: url.searchParams.get("campaignId") ?? undefined,
    tagId: url.searchParams.get("tagId") ?? undefined,
    collectionId: url.searchParams.get("collectionId") ?? undefined,
    includeArchived: url.searchParams.get("includeArchived") === "true",
  });

  return withDigitalAssetsRead(request, organisationId, async ({ tenant }) => {
    const assets = await digitalAssetService.list(brandId, organisationId, tenant!, query);
    return apiSuccess({ assets });
  });
}
