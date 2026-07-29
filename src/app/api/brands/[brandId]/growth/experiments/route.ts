import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { requireOrganisationId, withGrowthRead } from "@/lib/api/growth-handler";
import { growthRecommendationService } from "@/server/services/growth-recommendation-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withGrowthRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await growthRecommendationService.listExperiments(brandId, organisationId, tenant!),
      { requestId },
    ),
  );
}
