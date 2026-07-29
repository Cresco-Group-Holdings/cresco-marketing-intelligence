import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { withGrowthRead } from "@/lib/api/growth-handler";
import { growthRecommendationService } from "@/server/services/growth-recommendation-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  return withGrowthRead(request, async ({ requestId, tenant }) =>
    apiSuccess(
      await growthRecommendationService.listExperiments(brandId, tenant!.organisationId, tenant!),
      { requestId },
    ),
  );
}
