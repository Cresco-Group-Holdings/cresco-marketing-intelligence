import { NextRequest } from "next/server";
import { brandKnowledgeService } from "@/server/services";
import {
  apiSuccess,
  requireOrganisationId,
  withBrandKnowledgeRead,
  type BrandParams,
} from "@/lib/api/brand-knowledge-handler";

export async function GET(request: NextRequest, { params }: BrandParams) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);

  return withBrandKnowledgeRead(request, organisationId, async ({ requestId, tenant }) => {
    const result = await brandKnowledgeService.getSummary(brandId, organisationId, tenant!);
    return apiSuccess(result, { requestId });
  });
}
