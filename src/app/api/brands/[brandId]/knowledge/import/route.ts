import { NextRequest } from "next/server";
import { brandKnowledgeService } from "@/server/services";
import { brandKnowledgeImportSchema } from "@/lib/validation/brand-knowledge";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  requireOrganisationId,
  withBrandKnowledgeWrite,
  type BrandParams,
} from "@/lib/api/brand-knowledge-handler";

export async function POST(request: NextRequest, { params }: BrandParams) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);

  return withBrandKnowledgeWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(brandKnowledgeImportSchema, await jsonBody(request));
    const knowledge = await brandKnowledgeService.importKnowledge(
      brandId,
      organisationId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess({ knowledge }, { requestId });
  });
}
