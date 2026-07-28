import { NextRequest } from "next/server";
import { brandKnowledgeService } from "@/server/services";
import { brandPersonaUpdateSchema } from "@/lib/validation/brand-knowledge";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  requireOrganisationId,
  withBrandKnowledgeWrite,
} from "@/lib/api/brand-knowledge-handler";

type Params = { params: Promise<{ brandId: string; personaId: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { brandId, personaId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBrandKnowledgeWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(brandPersonaUpdateSchema, await jsonBody(request));
    const persona = await brandKnowledgeService.personas.update(brandId, organisationId, personaId, body, tenant!, requestId);
    return apiSuccess({ persona }, { requestId });
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { brandId, personaId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBrandKnowledgeWrite(request, organisationId, async ({ requestId, tenant }) => {
    const persona = await brandKnowledgeService.personas.archive(brandId, organisationId, personaId, tenant!, requestId);
    return apiSuccess({ persona }, { requestId });
  });
}
