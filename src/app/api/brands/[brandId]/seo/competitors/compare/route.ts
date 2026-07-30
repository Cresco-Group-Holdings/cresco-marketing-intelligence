import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withCompetitorsAnalyze,
} from "@/lib/api/competitors-handler";
import { comparePagesSchema } from "@/lib/validation/competitors";
import { seoCompetitorAnalysisService } from "@/server/services/seo-competitor-analysis-service";
import { seoCompetitorAiService } from "@/server/services/seo-competitor-ai-service";

type Params = { params: Promise<{ brandId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const action = request.nextUrl.searchParams.get("action");
  const competitorId = request.nextUrl.searchParams.get("competitorId");

  if (action === "analyze" && competitorId) {
    return withCompetitorsAnalyze(request, organisationId, async ({ requestId, tenant }) =>
      apiSuccess(
        await seoCompetitorAiService.analyzeCompetitor(competitorId, brandId, organisationId, tenant!),
        { requestId },
      ),
    );
  }

  if (!competitorId) {
    return withCompetitorsAnalyze(request, organisationId, async ({ requestId }) =>
      apiSuccess({ error: "competitorId required" }, { requestId }),
    );
  }

  const body = await request.json();
  return withCompetitorsAnalyze(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(comparePagesSchema, body);
    const result = await seoCompetitorAnalysisService.comparePages(
      competitorId,
      brandId,
      organisationId,
      input,
      tenant!,
    );
    return apiSuccess(result, { requestId });
  });
}
