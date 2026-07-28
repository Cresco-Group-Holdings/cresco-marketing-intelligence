import { NextRequest } from "next/server";
import { brandKnowledgeService } from "@/server/services";
import { brandAudienceUpdateSchema } from "@/lib/validation/brand-knowledge";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  requireOrganisationId,
  withBrandKnowledgeWrite,
} from "@/lib/api/brand-knowledge-handler";

type Params = { params: Promise<{ brandId: string; audienceId: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { brandId, audienceId } = await params;
  const organisationId = requireOrganisationId(request);

  return withBrandKnowledgeWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(brandAudienceUpdateSchema, await jsonBody(request));
    const audience = await brandKnowledgeService.audiences.update(
      brandId,
      organisationId,
      audienceId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess({ audience }, { requestId });
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { brandId, audienceId } = await params;
  const organisationId = requireOrganisationId(request);

  return withBrandKnowledgeWrite(request, organisationId, async ({ requestId, tenant }) => {
    const audience = await brandKnowledgeService.audiences.archive(
      brandId,
      organisationId,
      audienceId,
      tenant!,
      requestId,
    );
    return apiSuccess({ audience }, { requestId });
  });
}
