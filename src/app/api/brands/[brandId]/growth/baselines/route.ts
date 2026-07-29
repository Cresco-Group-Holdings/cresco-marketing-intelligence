import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { requireOrganisationId, withGrowthRead } from "@/lib/api/growth-handler";
import { growthIntelligenceService } from "@/server/services/growth-intelligence-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withGrowthRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        benchmarks: await growthIntelligenceService.listBenchmarks(
          brandId,
          organisationId,
          tenant!,
        ),
        patterns: await growthIntelligenceService.listPatterns(
          brandId,
          organisationId,
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}
