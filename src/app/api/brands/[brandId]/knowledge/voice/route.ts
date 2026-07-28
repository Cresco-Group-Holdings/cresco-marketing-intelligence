import { NextRequest } from "next/server";
import { brandKnowledgeService } from "@/server/services";
import { brandVoiceRuleUpsertSchema } from "@/lib/validation/brand-knowledge";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  requireOrganisationId,
  withBrandKnowledgeRead,
  withBrandKnowledgeWrite,
  type BrandParams,
} from "@/lib/api/brand-knowledge-handler";

export async function GET(request: NextRequest, { params }: BrandParams) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBrandKnowledgeRead(request, organisationId, async ({ requestId, tenant }) => {
    const voice = await brandKnowledgeService.voice.get(brandId, organisationId, tenant!);
    return apiSuccess({ voice }, { requestId });
  });
}

export async function PUT(request: NextRequest, { params }: BrandParams) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBrandKnowledgeWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(brandVoiceRuleUpsertSchema, await jsonBody(request));
    const voice = await brandKnowledgeService.voice.upsert(brandId, organisationId, body, tenant!, requestId);
    return apiSuccess({ voice }, { requestId });
  });
}
