import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withMarketingAssetsRead,
} from "@/lib/api/marketing-assets-handler";
import { marketingAssetListQuerySchema } from "@/lib/validation/marketing-assets";
import { marketingAssetService } from "@/server/services";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const query = marketingAssetListQuerySchema.parse({
    status: request.nextUrl.searchParams.get("status") ?? undefined,
    assetType: request.nextUrl.searchParams.get("assetType") ?? undefined,
    tag: request.nextUrl.searchParams.get("tag") ?? undefined,
    approvedForMarketing: request.nextUrl.searchParams.get("approvedForMarketing") ?? undefined,
    view: request.nextUrl.searchParams.get("view") ?? undefined,
  });

  return withMarketingAssetsRead(request, organisationId, async ({ requestId, tenant }) => {
    const assets = await marketingAssetService.list(brandId, organisationId, tenant!, query);
    return apiSuccess({ assets, view: query.view ?? "grid" }, { requestId });
  });
}
