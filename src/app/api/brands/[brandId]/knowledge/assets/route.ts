import { NextRequest } from "next/server";
import { brandKnowledgeService } from "@/server/services";
import { brandAssetCreateSchema } from "@/lib/validation/brand-knowledge";
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
    const assets = await brandKnowledgeService.assets.list(brandId, organisationId, tenant!);
    return apiSuccess({ assets }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: BrandParams) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBrandKnowledgeWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(brandAssetCreateSchema, await jsonBody(request));
    const asset = await brandKnowledgeService.assets.create(brandId, organisationId, body, tenant!, requestId);
    return apiSuccess({ asset }, { requestId });
  });
}
