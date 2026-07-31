import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import {
  requireOrganisationId,
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
      { items: await seoCompetitorAnalysisService.listTopics(brandId, organisationId, tenant!, competitorId) },
      { requestId },
    ),
  );
}
