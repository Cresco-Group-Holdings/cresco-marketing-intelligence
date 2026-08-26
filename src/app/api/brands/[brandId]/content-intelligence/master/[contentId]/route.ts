import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withContentEdit } from "@/lib/api/content-handler";
import { contentIntelligenceMasterUpdateSchema } from "@/lib/validation/content-intelligence";
import { contentIntelligenceGenerationService } from "@/server/services/content-intelligence-generation-service";

type Params = { params: Promise<{ brandId: string; contentId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(contentIntelligenceMasterUpdateSchema, await jsonBody(request));

  return withContentEdit(request, organisationId, async ({ requestId, tenant }) => {
    const session = await contentIntelligenceGenerationService.updateMaster(
      brandId,
      organisationId,
      contentId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess({ session }, { requestId });
  });
}
