import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingTikTokAdsLaunch,
  withAdvertisingTikTokAdsRead,
} from "@/lib/api/advertising-tiktok-ads-handler";
import { advertisingTikTokAdsLaunchService } from "@/server/services/advertising-tiktok-ads-launch-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingTikTokAdsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ launches: await advertisingTikTokAdsLaunchService.list(brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "request-approvals") {
    return withAdvertisingTikTokAdsLaunch(request, organisationId, async ({ requestId, tenant }) => {
      const approvals = await advertisingTikTokAdsLaunchService.requestApprovals(body.mutationPlanId, brandId, organisationId, tenant!);
      return apiSuccess({ approvals }, { requestId });
    });
  }

  if (body.action === "approve-gate") {
    return withAdvertisingTikTokAdsLaunch(request, organisationId, async ({ requestId, tenant }) => {
      const approval = await advertisingTikTokAdsLaunchService.approveGate(body.mutationPlanId, brandId, organisationId, body, tenant!);
      return apiSuccess({ approval }, { requestId });
    });
  }

  if (body.action === "create-launch") {
    return withAdvertisingTikTokAdsLaunch(request, organisationId, async ({ requestId, tenant }) => {
      const launch = await advertisingTikTokAdsLaunchService.createLaunch(body.mutationPlanId, brandId, organisationId, tenant!);
      return apiSuccess({ launch }, { requestId });
    });
  }

  if (body.action === "execute-launch") {
    return withAdvertisingTikTokAdsLaunch(request, organisationId, async ({ requestId, tenant }) => {
      const launch = await advertisingTikTokAdsLaunchService.executeLaunch(body.launchId, brandId, organisationId, tenant!);
      return apiSuccess({ launch }, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
}
