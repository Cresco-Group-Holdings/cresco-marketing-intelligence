import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import {
  requireOrganisationId,
  withCompetitorsCrawl,
} from "@/lib/api/competitors-handler";
import { seoCompetitorCrawlService } from "@/server/services/seo-competitor-crawl-service";

type Params = { params: Promise<{ brandId: string; competitorId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, competitorId } = await params;
  const organisationId = requireOrganisationId(request);
  const idempotencyKey =
    request.headers.get("idempotency-key") ??
    request.nextUrl.searchParams.get("idempotencyKey") ??
    undefined;

  return withCompetitorsCrawl(request, organisationId, async ({ requestId, tenant }) => {
    const snapshot = await seoCompetitorCrawlService.startCrawl(
      competitorId,
      brandId,
      organisationId,
      tenant!,
      idempotencyKey,
    );
    return apiSuccess({ snapshot }, { requestId });
  });
}
