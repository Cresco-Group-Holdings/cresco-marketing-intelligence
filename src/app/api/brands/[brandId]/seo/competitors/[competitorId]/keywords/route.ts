import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withCompetitorsManage,
  withCompetitorsRead,
} from "@/lib/api/competitors-handler";
import { addCompetitorKeywordSchema } from "@/lib/validation/competitors";
import { seoCompetitorService } from "@/server/services/seo-competitor-service";

type Params = { params: Promise<{ brandId: string; competitorId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, competitorId } = await params;
  const organisationId = requireOrganisationId(request);
  return withCompetitorsRead(request, organisationId, async ({ requestId, tenant }) => {
    const competitor = await seoCompetitorService.getById(competitorId, brandId, organisationId, tenant!);
    return apiSuccess({ items: competitor.keywords }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, competitorId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withCompetitorsManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(addCompetitorKeywordSchema, body);
    const keyword = await seoCompetitorService.addKeyword(
      competitorId,
      brandId,
      organisationId,
      {
        ...input,
        observedAt: input.observedAt ? new Date(input.observedAt) : undefined,
      },
      tenant!,
    );
    return apiSuccess({ keyword }, { requestId });
  });
}
