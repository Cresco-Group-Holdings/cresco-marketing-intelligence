import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withContentGenerate } from "@/lib/api/content-handler";
import { contentRegenerateFieldSchema } from "@/lib/validation/content-generation";
import { contentGenerationService } from "@/server/services/content-generation-service";

type Params = { params: Promise<{ brandId: string; contentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(contentRegenerateFieldSchema, await jsonBody(request));
  return withContentGenerate(request, organisationId, async ({ requestId, tenant }) => {
    const result = await contentGenerationService.regenerateField(
      brandId,
      organisationId,
      contentId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess(result, { requestId });
  });
}
