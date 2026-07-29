import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { withGrowthRead } from "@/lib/api/growth-handler";
import { growthIntelligenceService } from "@/server/services/growth-intelligence-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  return withGrowthRead(request, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        benchmarks: await growthIntelligenceService.listBenchmarks(
          brandId,
          tenant!.organisationId,
          tenant!,
        ),
        patterns: await growthIntelligenceService.listPatterns(
          brandId,
          tenant!.organisationId,
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}
