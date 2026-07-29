import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { withGrowthGenerate, withGrowthRead } from "@/lib/api/growth-handler";
import {
  growthDraftSchema,
  growthFeedbackSchema,
} from "@/lib/validation/growth";
import { growthRecommendationService } from "@/server/services/growth-recommendation-service";

type Params = { params: Promise<{ brandId: string; recommendationId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, recommendationId } = await params;
  return withGrowthRead(request, async ({ requestId, tenant }) => {
    const recommendation = await growthRecommendationService.getById(
      brandId,
      tenant!.organisationId,
      recommendationId,
      tenant!,
    );
    if (!recommendation) throw new AppError("NOT_FOUND", "Recommendation not found.");
    return apiSuccess(recommendation, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, recommendationId } = await params;
  const action = request.nextUrl.searchParams.get("action");

  if (action === "explain") {
    return withGrowthGenerate(request, async ({ requestId, tenant }) =>
      apiSuccess(
        await growthRecommendationService.explainWithAi(
          brandId,
          tenant!.organisationId,
          recommendationId,
          tenant!,
          requestId,
        ),
        { requestId },
      ),
    );
  }

  if (action === "draft") {
    const body = await request.json();
    const input = parseBody(growthDraftSchema, body);
    return withGrowthGenerate(request, async ({ requestId, tenant }) =>
      apiSuccess(
        await growthRecommendationService.createDraft(
          brandId,
          tenant!.organisationId,
          recommendationId,
          input,
          tenant!,
          requestId,
        ),
        { requestId },
      ),
    );
  }

  const body = await request.json();
  const input = parseBody(growthFeedbackSchema, body);
  return withGrowthRead(request, async ({ requestId, tenant }) =>
    apiSuccess(
      await growthRecommendationService.recordFeedback(
        brandId,
        tenant!.organisationId,
        recommendationId,
        input,
        tenant!,
      ),
      { requestId },
    ),
  );
}
