import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingGoogleAdsConnect,
  withAdvertisingGoogleAdsRead,
} from "@/lib/api/advertising-google-ads-handler";
import { advertisingGoogleAdsAccountService } from "@/server/services/advertising-google-ads-account-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingGoogleAdsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { status: await advertisingGoogleAdsAccountService.getStatus(brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  const action = body.action as string;

  if (action === "assign") {
    return withAdvertisingGoogleAdsConnect(request, organisationId, async ({ requestId, tenant }) => {
      const account = await advertisingGoogleAdsAccountService.assignAccount(
        brandId,
        organisationId,
        {
          customerId: body.customerId,
          managerCustomerId: body.managerCustomerId,
          customerName: body.customerName,
        },
        tenant!,
      );
      return apiSuccess({ account }, { requestId });
    });
  }

  if (action === "disconnect") {
    return withAdvertisingGoogleAdsConnect(request, organisationId, async ({ requestId, tenant }) => {
      const account = await advertisingGoogleAdsAccountService.disconnect(brandId, organisationId, tenant!);
      return apiSuccess({ account }, { requestId });
    });
  }

  if (action === "list-accounts") {
    return withAdvertisingGoogleAdsRead(request, organisationId, async ({ requestId, tenant }) => {
      const accounts = await advertisingGoogleAdsAccountService.listAccessibleAccounts(brandId, organisationId, tenant!);
      return apiSuccess({ accounts }, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${action}`);
}
