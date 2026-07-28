import { NextRequest } from "next/server";
import { brandKnowledgeService } from "@/server/services";
import { brandReferenceUpdateSchema } from "@/lib/validation/brand-knowledge";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  requireOrganisationId,
  withBrandKnowledgeWrite,
} from "@/lib/api/brand-knowledge-handler";

type Params = { params: Promise<{ brandId: string; referenceId: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { brandId, referenceId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBrandKnowledgeWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(brandReferenceUpdateSchema, await jsonBody(request));
    const reference = await brandKnowledgeService.references.update(brandId, organisationId, referenceId, body, tenant!, requestId);
    return apiSuccess({ reference }, { requestId });
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { brandId, referenceId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBrandKnowledgeWrite(request, organisationId, async ({ requestId, tenant }) => {
    const reference = await brandKnowledgeService.references.archive(brandId, organisationId, referenceId, tenant!, requestId);
    return apiSuccess({ reference }, { requestId });
  });
}
