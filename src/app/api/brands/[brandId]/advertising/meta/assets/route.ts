import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import {
  requireOrganisationId,
  withAdvertisingMetaAdsRead,
} from "@/lib/api/advertising-meta-ads-handler";
import { advertisingMetaAdsAccountService } from "@/server/services/advertising-meta-ads-account-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingMetaAdsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ assets: await advertisingMetaAdsAccountService.listAssets(brandId, organisationId, tenant!) }, { requestId }),
  );
}
