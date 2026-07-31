import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import {
  requireOrganisationId,
  withCompetitorsAnalyze,
  withCompetitorsRead,
} from "@/lib/api/competitors-handler";
import { seoCompetitorAnalysisService } from "@/server/services/seo-competitor-analysis-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const competitorId = request.nextUrl.searchParams.get("competitorId") ?? undefined;
  return withCompetitorsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await seoCompetitorAnalysisService.listOverlaps(competitorId, brandId, organisationId, tenant!),
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const competitorId = request.nextUrl.searchParams.get("competitorId");
  if (!competitorId) {
    return withCompetitorsAnalyze(request, organisationId, async ({ requestId }) =>
      apiSuccess({ error: "competitorId required" }, { requestId }),
    );
  }
  return withCompetitorsAnalyze(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await seoCompetitorAnalysisService.calculateOverlaps(competitorId, brandId, organisationId, tenant!),
      { requestId },
    ),
  );
}
