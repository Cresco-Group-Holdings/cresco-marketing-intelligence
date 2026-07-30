import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withKeywordsManage,
  withKeywordsRead,
} from "@/lib/api/keywords-handler";
import { createKeywordSchema, keywordListFiltersSchema } from "@/lib/validation/keywords";
import { seoKeywordService } from "@/server/services/seo-keyword-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const filters = parseBody(
    keywordListFiltersSchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  return withKeywordsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { items: await seoKeywordService.list(brandId, organisationId, filters, tenant!) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withKeywordsManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(createKeywordSchema, body);
    const keyword = await seoKeywordService.createManual(brandId, organisationId, input, tenant!);
    return apiSuccess({ keyword }, { requestId });
  });
}
