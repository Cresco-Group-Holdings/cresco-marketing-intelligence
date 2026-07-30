import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingGoogleAdsManage,
  withAdvertisingGoogleAdsRead,
} from "@/lib/api/advertising-google-ads-handler";
import { advertisingGoogleAdsLaunchService } from "@/server/services/advertising-google-ads-launch-service";
import { advertisingGoogleAdsManagementService } from "@/server/services/advertising-google-ads-management-service";

type Params = { params: Promise<{ brandId: string; campaignId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, campaignId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingGoogleAdsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { launch: await advertisingGoogleAdsLaunchService.getById(campaignId, brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "preview-pause") {
    return withAdvertisingGoogleAdsManage(request, organisationId, async ({ requestId, tenant }) => {
      const preview = await advertisingGoogleAdsManagementService.previewPause(brandId, organisationId, body, tenant!);
      return apiSuccess({ preview }, { requestId });
    });
  }

  if (body.action === "confirm-pause") {
    return withAdvertisingGoogleAdsManage(request, organisationId, async ({ requestId, tenant }) => {
      const operation = await advertisingGoogleAdsManagementService.confirmPause(brandId, organisationId, body, tenant!);
      return apiSuccess({ operation }, { requestId });
    });
  }

  if (body.action === "preview-budget") {
    return withAdvertisingGoogleAdsManage(request, organisationId, async ({ requestId, tenant }) => {
      const preview = await advertisingGoogleAdsManagementService.previewBudgetAdjust(brandId, organisationId, body, tenant!);
      return apiSuccess({ preview }, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
}
