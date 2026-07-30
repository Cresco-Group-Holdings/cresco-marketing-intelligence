import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingMetaAdsConnect,
  withAdvertisingMetaAdsRead,
} from "@/lib/api/advertising-meta-ads-handler";
import { advertisingMetaAdsAccountService } from "@/server/services/advertising-meta-ads-account-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingMetaAdsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ status: await advertisingMetaAdsAccountService.getStatus(brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  const action = body.action as string;

  if (action === "assign") {
    return withAdvertisingMetaAdsConnect(request, organisationId, async ({ requestId, tenant }) => {
      const account = await advertisingMetaAdsAccountService.assignAssets(brandId, organisationId, body, tenant!);
      return apiSuccess({ account }, { requestId });
    });
  }

  if (action === "disconnect") {
    return withAdvertisingMetaAdsConnect(request, organisationId, async ({ requestId, tenant }) => {
      const account = await advertisingMetaAdsAccountService.disconnect(brandId, organisationId, tenant!);
      return apiSuccess({ account }, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${action}`);
}
