import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingPlansCreate,
  withAdvertisingPlansEdit,
  withAdvertisingPlansRead,
} from "@/lib/api/advertising-plans-handler";
import { createPlanSchema } from "@/lib/validation/advertising-plans";
import { advertisingCampaignPlanService } from "@/server/services/advertising-campaign-plan-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingPlansRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ items: await advertisingCampaignPlanService.list(brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withAdvertisingPlansCreate(request, organisationId, async ({ requestId, tenant, user }) => {
    if (!user?.userProfileId) throw new AppError("UNAUTHORIZED", "Authentication required.");
    const input = parseBody(createPlanSchema, body);
    const plan = await advertisingCampaignPlanService.create(brandId, organisationId, input, tenant!);
    return apiSuccess({ plan }, { requestId });
  });
}
