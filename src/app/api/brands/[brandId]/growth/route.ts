import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  growthFilters,
  requireOrganisationId,
  withGrowthGenerate,
  withGrowthRead,
} from "@/lib/api/growth-handler";
import { growthIntelligenceService } from "@/server/services/growth-intelligence-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withGrowthRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await growthIntelligenceService.getSummary(brandId, organisationId, tenant!),
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const filters = growthFilters(request);
  return withGrowthGenerate(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await growthIntelligenceService.analyze(brandId, organisationId, filters, tenant!),
      { requestId },
    ),
  );
}
