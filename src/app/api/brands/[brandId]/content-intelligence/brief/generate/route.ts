import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withContentGenerate } from "@/lib/api/content-handler";
import { contentIntelligenceBriefGenerateSchema } from "@/lib/validation/content-intelligence";
import { contentIntelligenceGenerationService } from "@/server/services/content-intelligence-generation-service";

type Params = { params: Promise<{ brandId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(contentIntelligenceBriefGenerateSchema, await jsonBody(request));

  return withContentGenerate(request, organisationId, async ({ requestId, tenant }) => {
    const session = await contentIntelligenceGenerationService.generateBrief(
      brandId,
      organisationId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess({ session }, { requestId });
  });
}
