import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingGoogleAdsDraft,
  withAdvertisingGoogleAdsRead,
  withAdvertisingGoogleAdsValidate,
} from "@/lib/api/advertising-google-ads-handler";
import { advertisingGoogleAdsDraftService } from "@/server/services/advertising-google-ads-draft-service";

type Params = { params: Promise<{ brandId: string; draftId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, draftId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingGoogleAdsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { draft: await advertisingGoogleAdsDraftService.getById(draftId, brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, draftId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "build-mutation-plan") {
    return withAdvertisingGoogleAdsDraft(request, organisationId, async ({ requestId, tenant }) => {
      const result = await advertisingGoogleAdsDraftService.buildMutationPlan(draftId, brandId, organisationId, tenant!);
      return apiSuccess(result, { requestId });
    });
  }

  if (body.action === "validate") {
    return withAdvertisingGoogleAdsValidate(request, organisationId, async ({ requestId, tenant }) => {
      const draft = await advertisingGoogleAdsDraftService.getById(draftId, brandId, organisationId, tenant!);
      return apiSuccess({ validation: draft.validationResult, status: draft.validationStatus }, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
}
