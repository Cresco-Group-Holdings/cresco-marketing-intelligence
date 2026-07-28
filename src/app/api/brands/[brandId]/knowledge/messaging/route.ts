import { NextRequest } from "next/server";
import { brandKnowledgeService } from "@/server/services";
import { brandMessageUpsertSchema } from "@/lib/validation/brand-knowledge";
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
    const messaging = await brandKnowledgeService.messaging.get(brandId, organisationId, tenant!);
    return apiSuccess({ messaging }, { requestId });
  });
}

export async function PUT(request: NextRequest, { params }: BrandParams) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBrandKnowledgeWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(brandMessageUpsertSchema, await jsonBody(request));
    const messaging = await brandKnowledgeService.messaging.upsert(brandId, organisationId, body, tenant!, requestId);
    return apiSuccess({ messaging }, { requestId });
  });
}
