import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { requireOrganisationId, withGrowthRead } from "@/lib/api/growth-handler";
import { growthIntelligenceService } from "@/server/services/growth-intelligence-service";

type Params = { params: Promise<{ brandId: string; insightId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, insightId } = await params;
  const organisationId = requireOrganisationId(request);
  return withGrowthRead(request, organisationId, async ({ requestId, tenant }) => {
    const insight = await growthIntelligenceService.getInsight(
      brandId,
      organisationId,
      insightId,
      tenant!,
    );
    if (!insight) throw new AppError("NOT_FOUND", "Insight not found.");
    return apiSuccess(insight, { requestId });
  });
}
