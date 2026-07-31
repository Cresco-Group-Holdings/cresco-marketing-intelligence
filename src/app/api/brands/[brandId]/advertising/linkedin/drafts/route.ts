import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingLinkedInAdsDraft,
  withAdvertisingLinkedInAdsRead,
} from "@/lib/api/advertising-linkedin-ads-handler";
import { advertisingLinkedInAdsDraftService } from "@/server/services/advertising-linkedin-ads-draft-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingLinkedInAdsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ drafts: await advertisingLinkedInAdsDraftService.list(brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "create-from-plan") {
    return withAdvertisingLinkedInAdsDraft(request, organisationId, async ({ requestId, tenant }) => {
      if (!body.planId) throw new AppError("VALIDATION_ERROR", "planId is required.");
      const draft = await advertisingLinkedInAdsDraftService.createFromPlan(body.planId, brandId, organisationId, tenant!);
      return apiSuccess({ draft }, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
}
