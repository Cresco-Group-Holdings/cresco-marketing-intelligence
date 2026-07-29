import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withContentIdeas } from "@/lib/api/content-handler";
import { contentIdeasRequestSchema } from "@/lib/validation/content-generation";
import { contentGenerationService } from "@/server/services/content-generation-service";

type Params = { params: Promise<{ brandId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(contentIdeasRequestSchema, await jsonBody(request));
  return withContentIdeas(request, organisationId, async ({ requestId, tenant }) => {
    const result = await contentGenerationService.generateIdeas(
      brandId,
      organisationId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess(result, { requestId });
  });
}
