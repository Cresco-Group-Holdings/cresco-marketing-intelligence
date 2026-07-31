import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withKeywordsManage,
  withKeywordsRead,
} from "@/lib/api/keywords-handler";
import { aiSuggestionSchema } from "@/lib/validation/keywords";
import {
  seoKeywordGscSyncService,
  seoKeywordOpportunityService,
} from "@/server/services/seo-keyword-opportunity-service";
import { seoKeywordAiService } from "@/server/services/seo-keyword-ai-service";
import { detectCannibalisation } from "@/lib/keywords/cannibalisation";
import { prisma } from "@/lib/database/prisma";
import { brandService } from "@/server/services/workspace-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const type = request.nextUrl.searchParams.get("type") ?? "opportunities";

  return withKeywordsRead(request, organisationId, async ({ requestId, tenant }) => {
    if (type === "cannibalisation") {
      await brandService.getById(brandId, organisationId, tenant!);
      const keywords = await prisma.seoKeyword.findMany({
        where: { brandId, organisationId, status: "ACTIVE" },
        include: {
          pageMappings: { include: { page: { select: { normalisedUrl: true } } } },
          metrics: { where: { metricType: "RANK_POSITION" }, take: 5 },
        },
        take: 100,
      });
      const candidates = keywords
        .map((kw) => {
          const pages = kw.pageMappings.map((m) => ({
            url: m.page?.normalisedUrl ?? m.intendedUrl ?? "",
            position: kw.metrics[0]?.value ?? undefined,
            isExplicitTarget: ["PRIMARY_TARGET", "SECONDARY_TARGET"].includes(m.relationType),
          }));
          return detectCannibalisation(kw.displayKeyword, pages);
        })
        .filter(Boolean);
      return apiSuccess({ items: candidates }, { requestId });
    }

    const items = await seoKeywordOpportunityService.list(brandId, organisationId, tenant!);
    return apiSuccess({ items }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const action = request.nextUrl.searchParams.get("action");

  return withKeywordsManage(request, organisationId, async ({ requestId, tenant }) => {
    if (action === "sync-gsc") {
      const result = await seoKeywordGscSyncService.syncFromWarehouseQueries(
        brandId,
        organisationId,
        tenant!,
      );
      return apiSuccess(result, { requestId });
    }
    if (action === "evaluate") {
      const result = await seoKeywordOpportunityService.evaluateForBrand(
        brandId,
        organisationId,
        tenant!,
      );
      return apiSuccess(result, { requestId });
    }
    const body = await request.json();
    const input = parseBody(aiSuggestionSchema, body);
    const result = await seoKeywordAiService.suggestKeywords(
      brandId,
      organisationId,
      input,
      tenant!,
    );
    return apiSuccess(result, { requestId });
  });
}
