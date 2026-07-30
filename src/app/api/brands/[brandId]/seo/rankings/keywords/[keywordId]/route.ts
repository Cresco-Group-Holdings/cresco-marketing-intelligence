import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withRankTrackingRead } from "@/lib/api/rank-tracking-handler";
import { seoRankTrackingService } from "@/server/services/seo-rank-tracking-service";

type Params = { params: Promise<{ brandId: string; keywordId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, keywordId } = await params;
  const organisationId = requireOrganisationId(request);
  return withRankTrackingRead(request, organisationId, async ({ requestId, tenant }) => {
    const result = await seoRankTrackingService.getKeywordHistory(keywordId, brandId, organisationId, tenant!);
    return apiSuccess(result, { requestId });
  });
}
