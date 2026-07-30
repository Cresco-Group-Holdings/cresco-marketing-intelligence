import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingLinkedInAdsDraft,
  withAdvertisingLinkedInAdsRead,
} from "@/lib/api/advertising-linkedin-ads-handler";
import { advertisingLinkedInAdsDraftService } from "@/server/services/advertising-linkedin-ads-draft-service";

type Params = { params: Promise<{ brandId: string; draftId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, draftId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingLinkedInAdsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ draft: await advertisingLinkedInAdsDraftService.getById(draftId, brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, draftId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "build-mutation-plan") {
    return withAdvertisingLinkedInAdsDraft(request, organisationId, async ({ requestId, tenant }) => {
      const result = await advertisingLinkedInAdsDraftService.buildMutationPlan(draftId, brandId, organisationId, tenant!);
      return apiSuccess(result, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
}
