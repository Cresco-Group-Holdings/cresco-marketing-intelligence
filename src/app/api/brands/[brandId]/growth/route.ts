import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  growthFilters,
  withGrowthGenerate,
  withGrowthRead,
} from "@/lib/api/growth-handler";
import { growthIntelligenceService } from "@/server/services/growth-intelligence-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  return withGrowthRead(request, async ({ requestId, tenant }) =>
    apiSuccess(
      await growthIntelligenceService.getSummary(brandId, tenant!.organisationId, tenant!),
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const filters = growthFilters(request);
  const force = request.nextUrl.searchParams.get("force") === "true";
  return withGrowthGenerate(request, async ({ requestId, tenant }) =>
    apiSuccess(
      await growthIntelligenceService.analyze(brandId, tenant!.organisationId, filters, tenant!, {
        force,
      }),
      { requestId },
    ),
  );
}
