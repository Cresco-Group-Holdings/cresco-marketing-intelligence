import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import {
  requireOrganisationId,
  withAdvertisingMetaAdsRead,
} from "@/lib/api/advertising-meta-ads-handler";
import { advertisingMetaAdsDraftService } from "@/server/services/advertising-meta-ads-draft-service";

type Params = { params: Promise<{ brandId: string; draftId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, draftId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingMetaAdsRead(request, organisationId, async ({ requestId, tenant }) => {
    const draft = await advertisingMetaAdsDraftService.getById(draftId, brandId, organisationId, tenant!);
    return apiSuccess({
      review: {
        validationResult: draft.validationResult,
        validationStatus: draft.validationStatus,
        reviewStatus: draft.reviewStatus,
        reviewNotes: draft.reviewNotes,
        localOnlyDisclaimer: "Local validation does not guarantee Meta policy approval.",
      },
    }, { requestId });
  });
}
