import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingLinkedInAdsLaunch,
  withAdvertisingLinkedInAdsRead,
} from "@/lib/api/advertising-linkedin-ads-handler";
import { advertisingLinkedInAdsLaunchService } from "@/server/services/advertising-linkedin-ads-launch-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingLinkedInAdsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ launches: await advertisingLinkedInAdsLaunchService.list(brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "request-approvals") {
    return withAdvertisingLinkedInAdsLaunch(request, organisationId, async ({ requestId, tenant }) => {
      const approvals = await advertisingLinkedInAdsLaunchService.requestApprovals(body.mutationPlanId, brandId, organisationId, tenant!);
      return apiSuccess({ approvals }, { requestId });
    });
  }

  if (body.action === "approve-gate") {
    return withAdvertisingLinkedInAdsLaunch(request, organisationId, async ({ requestId, tenant }) => {
      const approval = await advertisingLinkedInAdsLaunchService.approveGate(body.mutationPlanId, brandId, organisationId, body, tenant!);
      return apiSuccess({ approval }, { requestId });
    });
  }

  if (body.action === "create-launch") {
    return withAdvertisingLinkedInAdsLaunch(request, organisationId, async ({ requestId, tenant }) => {
      const launch = await advertisingLinkedInAdsLaunchService.createLaunch(body.mutationPlanId, brandId, organisationId, tenant!);
      return apiSuccess({ launch }, { requestId });
    });
  }

  if (body.action === "execute-launch") {
    return withAdvertisingLinkedInAdsLaunch(request, organisationId, async ({ requestId, tenant }) => {
      const launch = await advertisingLinkedInAdsLaunchService.executeLaunch(body.launchId, brandId, organisationId, tenant!);
      return apiSuccess({ launch }, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
}
