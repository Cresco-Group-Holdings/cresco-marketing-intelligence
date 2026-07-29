import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withGrowthGenerate } from "@/lib/api/growth-handler";
import { growthExperimentUpdateSchema } from "@/lib/validation/growth";
import { growthRecommendationService } from "@/server/services/growth-recommendation-service";

type Params = { params: Promise<{ brandId: string; experimentId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId, experimentId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  const input = parseBody(growthExperimentUpdateSchema, body);
  return withGrowthGenerate(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await growthRecommendationService.updateExperiment(
        brandId,
        organisationId,
        experimentId,
        input,
        tenant!,
      ),
      { requestId },
    ),
  );
}
