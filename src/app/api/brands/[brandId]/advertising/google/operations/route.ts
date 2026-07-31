import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import {
  requireOrganisationId,
  withAdvertisingGoogleAdsRead,
} from "@/lib/api/advertising-google-ads-handler";
import { advertisingGoogleAdsLaunchService } from "@/server/services/advertising-google-ads-launch-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingGoogleAdsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { operations: await advertisingGoogleAdsLaunchService.listOperations(brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}
