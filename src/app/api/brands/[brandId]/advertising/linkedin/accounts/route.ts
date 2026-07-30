import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingLinkedInAdsConnect,
  withAdvertisingLinkedInAdsRead,
} from "@/lib/api/advertising-linkedin-ads-handler";
import { advertisingLinkedInAdsAccountService } from "@/server/services/advertising-linkedin-ads-account-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingLinkedInAdsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ status: await advertisingLinkedInAdsAccountService.getStatus(brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "assign") {
    return withAdvertisingLinkedInAdsConnect(request, organisationId, async ({ requestId, tenant }) => {
      const account = await advertisingLinkedInAdsAccountService.assignAccount(brandId, organisationId, body, tenant!);
      return apiSuccess({ account }, { requestId });
    });
  }

  if (body.action === "disconnect") {
    return withAdvertisingLinkedInAdsConnect(request, organisationId, async ({ requestId, tenant }) => {
      const account = await advertisingLinkedInAdsAccountService.disconnect(brandId, organisationId, tenant!);
      return apiSuccess({ account }, { requestId });
    });
  }

  if (body.action === "list-assets") {
    return withAdvertisingLinkedInAdsRead(request, organisationId, async ({ requestId, tenant }) => {
      const assets = await advertisingLinkedInAdsAccountService.listAssets(brandId, organisationId, tenant!);
      return apiSuccess({ assets }, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
}
