import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingGoogleAdsLaunch,
  withAdvertisingGoogleAdsRead,
} from "@/lib/api/advertising-google-ads-handler";
import { advertisingGoogleAdsLaunchService } from "@/server/services/advertising-google-ads-launch-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingGoogleAdsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ launches: await advertisingGoogleAdsLaunchService.list(brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "request-approvals") {
    return withAdvertisingGoogleAdsLaunch(request, organisationId, async ({ requestId, tenant }) => {
      const approvals = await advertisingGoogleAdsLaunchService.requestApprovals(
        body.mutationPlanId,
        brandId,
        organisationId,
        tenant!,
      );
      return apiSuccess({ approvals }, { requestId });
    });
  }

  if (body.action === "approve-gate") {
    return withAdvertisingGoogleAdsLaunch(request, organisationId, async ({ requestId, tenant }) => {
      const approval = await advertisingGoogleAdsLaunchService.approveGate(
        body.mutationPlanId,
        brandId,
        organisationId,
        { approvalType: body.approvalType, decision: body.decision, notes: body.notes },
        tenant!,
      );
      return apiSuccess({ approval }, { requestId });
    });
  }

  if (body.action === "validate-mutation") {
    return withAdvertisingGoogleAdsLaunch(request, organisationId, async ({ requestId, tenant }) => {
      const result = await advertisingGoogleAdsLaunchService.validateMutationPlan(
        body.mutationPlanId,
        brandId,
        organisationId,
        tenant!,
      );
      return apiSuccess(result, { requestId });
    });
  }

  if (body.action === "create-launch") {
    return withAdvertisingGoogleAdsLaunch(request, organisationId, async ({ requestId, tenant }) => {
      const launch = await advertisingGoogleAdsLaunchService.createLaunch(
        body.mutationPlanId,
        brandId,
        organisationId,
        tenant!,
      );
      return apiSuccess({ launch }, { requestId });
    });
  }

  if (body.action === "execute-launch") {
    return withAdvertisingGoogleAdsLaunch(request, organisationId, async ({ requestId, tenant }) => {
      const launch = await advertisingGoogleAdsLaunchService.executeLaunch(
        body.launchId,
        brandId,
        organisationId,
        tenant!,
      );
      return apiSuccess({ launch }, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
}
