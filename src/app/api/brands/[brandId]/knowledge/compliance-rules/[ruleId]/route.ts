import { NextRequest } from "next/server";
import { brandKnowledgeService } from "@/server/services";
import { brandComplianceRuleUpdateSchema } from "@/lib/validation/brand-knowledge";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  requireOrganisationId,
  withBrandKnowledgeWrite,
} from "@/lib/api/brand-knowledge-handler";

type Params = { params: Promise<{ brandId: string; ruleId: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { brandId, ruleId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBrandKnowledgeWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const body = parseBody(brandComplianceRuleUpdateSchema, await jsonBody(request));
    const complianceRule = await brandKnowledgeService.complianceRules.update(brandId, organisationId, ruleId, body, tenant!, requestId);
    return apiSuccess({ complianceRule }, { requestId });
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { brandId, ruleId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBrandKnowledgeWrite(request, organisationId, async ({ requestId, tenant }) => {
    const complianceRule = await brandKnowledgeService.complianceRules.archive(brandId, organisationId, ruleId, tenant!, requestId);
    return apiSuccess({ complianceRule }, { requestId });
  });
}
