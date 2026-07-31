import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingTikTokAdsDraft,
  withAdvertisingTikTokAdsRead,
} from "@/lib/api/advertising-tiktok-ads-handler";
import { advertisingTikTokAdsDraftService } from "@/server/services/advertising-tiktok-ads-draft-service";

type Params = { params: Promise<{ brandId: string; draftId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, draftId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingTikTokAdsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ draft: await advertisingTikTokAdsDraftService.getById(draftId, brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, draftId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "build-mutation-plan") {
    return withAdvertisingTikTokAdsDraft(request, organisationId, async ({ requestId, tenant }) => {
      const result = await advertisingTikTokAdsDraftService.buildMutationPlan(draftId, brandId, organisationId, tenant!);
      return apiSuccess(result, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
}
