import { NextRequest } from "next/server";
import { brandKnowledgeService } from "@/server/services";
import { brandAssetUpdateSchema } from "@/lib/validation/brand-knowledge";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  requireOrganisationId,
  withBrandKnowledgeWrite,
} from "@/lib/api/brand-knowledge-handler";

type Params = { params: Promise<{ brandId: string; assetId: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { brandId, assetId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBrandKnowledgeWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(brandAssetUpdateSchema, await jsonBody(request));
    const asset = await brandKnowledgeService.assets.update(brandId, organisationId, assetId, body, tenant!, requestId);
    return apiSuccess({ asset }, { requestId });
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { brandId, assetId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBrandKnowledgeWrite(request, organisationId, async ({ requestId, tenant }) => {
    const asset = await brandKnowledgeService.assets.archive(brandId, organisationId, assetId, tenant!, requestId);
    return apiSuccess({ asset }, { requestId });
  });
}
