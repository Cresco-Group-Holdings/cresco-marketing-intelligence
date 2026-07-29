import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withContentGenerate } from "@/lib/api/content-handler";
import { contentGenerationRequestSchema } from "@/lib/validation/content-generation";
import { contentGenerationService } from "@/server/services/content-generation-service";

type Params = { params: Promise<{ brandId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(contentGenerationRequestSchema, await jsonBody(request));
  return withContentGenerate(request, organisationId, async ({ requestId, tenant }) => {
    const generated = await contentGenerationService.generate(
      brandId,
      organisationId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess(generated, { requestId });
  });
}
