import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingMetaAdsManage,
  withAdvertisingMetaAdsRead,
} from "@/lib/api/advertising-meta-ads-handler";
import { advertisingMetaAdsLaunchService } from "@/server/services/advertising-meta-ads-launch-service";
import { advertisingMetaAdsManagementService } from "@/server/services/advertising-meta-ads-management-service";

type Params = { params: Promise<{ brandId: string; campaignId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, campaignId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingMetaAdsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ launch: await advertisingMetaAdsLaunchService.getById(campaignId, brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "preview-pause") {
    return withAdvertisingMetaAdsManage(request, organisationId, async ({ requestId, tenant }) => {
      const preview = await advertisingMetaAdsManagementService.previewPause(brandId, organisationId, body, tenant!);
      return apiSuccess({ preview }, { requestId });
    });
  }

  if (body.action === "confirm-pause") {
    return withAdvertisingMetaAdsManage(request, organisationId, async ({ requestId, tenant }) => {
      const operation = await advertisingMetaAdsManagementService.confirmPause(brandId, organisationId, body, tenant!);
      return apiSuccess({ operation }, { requestId });
    });
  }

  if (body.action === "preview-budget") {
    return withAdvertisingMetaAdsManage(request, organisationId, async ({ requestId, tenant }) => {
      const preview = await advertisingMetaAdsManagementService.previewBudget(brandId, organisationId, body, tenant!);
      return apiSuccess({ preview }, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
}
