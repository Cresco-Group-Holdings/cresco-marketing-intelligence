import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingMetaAdsDraft,
  withAdvertisingMetaAdsRead,
} from "@/lib/api/advertising-meta-ads-handler";
import { advertisingMetaAdsDraftService } from "@/server/services/advertising-meta-ads-draft-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingMetaAdsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ drafts: await advertisingMetaAdsDraftService.list(brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "create-from-plan") {
    return withAdvertisingMetaAdsDraft(request, organisationId, async ({ requestId, tenant }) => {
      if (!body.planId) throw new AppError("VALIDATION_ERROR", "planId is required.");
      const draft = await advertisingMetaAdsDraftService.createFromPlan(body.planId, brandId, organisationId, tenant!);
      return apiSuccess({ draft }, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
}
