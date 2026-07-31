import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingMetaAdsLaunch,
  withAdvertisingMetaAdsRead,
} from "@/lib/api/advertising-meta-ads-handler";
import { advertisingMetaAdsCapiService, advertisingMetaAdsLaunchService } from "@/server/services/advertising-meta-ads-launch-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingMetaAdsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ launches: await advertisingMetaAdsLaunchService.list(brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "request-approvals") {
    return withAdvertisingMetaAdsLaunch(request, organisationId, async ({ requestId, tenant }) => {
      const approvals = await advertisingMetaAdsLaunchService.requestApprovals(body.mutationPlanId, brandId, organisationId, tenant!);
      return apiSuccess({ approvals }, { requestId });
    });
  }

  if (body.action === "approve-gate") {
    return withAdvertisingMetaAdsLaunch(request, organisationId, async ({ requestId, tenant }) => {
      const approval = await advertisingMetaAdsLaunchService.approveGate(body.mutationPlanId, brandId, organisationId, body, tenant!);
      return apiSuccess({ approval }, { requestId });
    });
  }

  if (body.action === "create-launch") {
    return withAdvertisingMetaAdsLaunch(request, organisationId, async ({ requestId, tenant }) => {
      const launch = await advertisingMetaAdsLaunchService.createLaunch(body.mutationPlanId, brandId, organisationId, tenant!);
      return apiSuccess({ launch }, { requestId });
    });
  }

  if (body.action === "execute-launch") {
    return withAdvertisingMetaAdsLaunch(request, organisationId, async ({ requestId, tenant }) => {
      const launch = await advertisingMetaAdsLaunchService.executeLaunch(body.launchId, brandId, organisationId, tenant!);
      return apiSuccess({ launch }, { requestId });
    });
  }

  if (body.action === "queue-capi-event") {
    return withAdvertisingMetaAdsLaunch(request, organisationId, async ({ requestId, tenant }) => {
      const event = await advertisingMetaAdsCapiService.queueEvent(brandId, organisationId, body, tenant!);
      return apiSuccess({ event }, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
}
