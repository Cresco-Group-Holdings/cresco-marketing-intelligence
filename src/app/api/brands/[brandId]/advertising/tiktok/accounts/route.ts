import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingTikTokAdsConnect,
  withAdvertisingTikTokAdsRead,
} from "@/lib/api/advertising-tiktok-ads-handler";
import { advertisingTikTokAdsAccountService } from "@/server/services/advertising-tiktok-ads-account-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingTikTokAdsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ status: await advertisingTikTokAdsAccountService.getStatus(brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "assign") {
    return withAdvertisingTikTokAdsConnect(request, organisationId, async ({ requestId, tenant }) => {
      const account = await advertisingTikTokAdsAccountService.assignAccount(brandId, organisationId, body, tenant!);
      return apiSuccess({ account }, { requestId });
    });
  }

  if (body.action === "disconnect") {
    return withAdvertisingTikTokAdsConnect(request, organisationId, async ({ requestId, tenant }) => {
      const account = await advertisingTikTokAdsAccountService.disconnect(brandId, organisationId, tenant!);
      return apiSuccess({ account }, { requestId });
    });
  }

  if (body.action === "list-assets") {
    return withAdvertisingTikTokAdsRead(request, organisationId, async ({ requestId, tenant }) => {
      const assets = await advertisingTikTokAdsAccountService.listAssets(brandId, organisationId, tenant!);
      return apiSuccess({ assets }, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
}
