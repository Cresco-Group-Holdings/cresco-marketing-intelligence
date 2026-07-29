import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { withGrowthGenerate, withGrowthRead } from "@/lib/api/growth-handler";
import { growthIntelligenceService } from "@/server/services/growth-intelligence-service";
import { growthRecommendationService } from "@/server/services/growth-recommendation-service";

type Params = { params: Promise<{ brandId: string; insightId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, insightId } = await params;
  return withGrowthRead(request, async ({ requestId, tenant }) => {
    const insight = await growthIntelligenceService.getInsight(
      brandId,
      tenant!.organisationId,
      insightId,
      tenant!,
    );
    if (!insight) throw new AppError("NOT_FOUND", "Insight not found.");
    return apiSuccess(insight, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, insightId } = await params;
  const action = request.nextUrl.searchParams.get("action");
  return withGrowthGenerate(request, async ({ requestId, tenant }) => {
    if (action !== "explain") {
      throw new AppError("VALIDATION_ERROR", "Unsupported insight action.");
    }
    return apiSuccess(
      await growthRecommendationService.explainInsightWithAi(
        brandId,
        tenant!.organisationId,
        insightId,
        tenant!,
        requestId,
      ),
      { requestId },
    );
  });
}
