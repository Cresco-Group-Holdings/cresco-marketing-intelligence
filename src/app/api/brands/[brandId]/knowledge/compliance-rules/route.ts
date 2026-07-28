import { NextRequest } from "next/server";
import { brandKnowledgeService } from "@/server/services";
import { brandComplianceRuleCreateSchema } from "@/lib/validation/brand-knowledge";
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
    const complianceRules = await brandKnowledgeService.complianceRules.list(brandId, organisationId, tenant!);
    return apiSuccess({ complianceRules }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: BrandParams) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBrandKnowledgeWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(brandComplianceRuleCreateSchema, await jsonBody(request));
    const complianceRule = await brandKnowledgeService.complianceRules.create(brandId, organisationId, body, tenant!, requestId);
    return apiSuccess({ complianceRule }, { requestId });
  });
}
