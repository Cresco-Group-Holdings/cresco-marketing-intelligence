import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withKeywordsManage,
  withKeywordsRead,
} from "@/lib/api/keywords-handler";
import {
  intentOverrideSchema,
  pageMappingSchema,
  updateKeywordSchema,
} from "@/lib/validation/keywords";
import { seoKeywordAiService } from "@/server/services/seo-keyword-ai-service";
import { seoKeywordService } from "@/server/services/seo-keyword-service";

type Params = { params: Promise<{ brandId: string; keywordId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, keywordId } = await params;
  const organisationId = requireOrganisationId(request);
  return withKeywordsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { keyword: await seoKeywordService.getById(keywordId, brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId, keywordId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withKeywordsManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(updateKeywordSchema, body);
    const keyword =
      input.status != null
        ? await seoKeywordService.updateStatus(
            keywordId,
            brandId,
            organisationId,
            input.status,
            input.note,
            tenant!,
          )
        : await seoKeywordService.getById(keywordId, brandId, organisationId, tenant!);
    return apiSuccess({ keyword }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, keywordId } = await params;
  const organisationId = requireOrganisationId(request);
  const action = request.nextUrl.searchParams.get("action");
  const body = await request.json();

  return withKeywordsManage(request, organisationId, async ({ requestId, tenant }) => {
    if (action === "intent") {
      const input = parseBody(intentOverrideSchema, body);
      const keyword = await seoKeywordService.overrideIntent(
        keywordId,
        brandId,
        organisationId,
        input.intent,
        input.note,
        tenant!,
      );
      return apiSuccess({ keyword }, { requestId });
    }
    if (action === "page-mapping") {
      const input = parseBody(pageMappingSchema, body);
      const mapping = await seoKeywordService.addPageMapping(
        keywordId,
        brandId,
        organisationId,
        input,
        tenant!,
      );
      return apiSuccess({ mapping }, { requestId });
    }
    if (action === "ai-intent") {
      const keyword = await seoKeywordAiService.classifyIntentWithAi(
        keywordId,
        brandId,
        organisationId,
        tenant!,
      );
      return apiSuccess({ keyword }, { requestId });
    }
    if (action === "ai-entities") {
      const entities = await seoKeywordAiService.extractEntities(
        keywordId,
        brandId,
        organisationId,
        tenant!,
      );
      return apiSuccess({ entities }, { requestId });
    }
    return apiSuccess({ error: "Unknown action" }, { requestId });
  });
}
