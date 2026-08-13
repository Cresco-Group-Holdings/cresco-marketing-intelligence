import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withApprovalsRead,
  withApprovalsDecide,
} from "@/lib/api/approvals-handler";
import { marketingApprovalDecisionSchema } from "@/lib/validation/marketing-approvals";
import { marketingApprovalService } from "@/server/services/marketing-approval-service";

type Params = { params: Promise<{ brandId: string; approvalId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, approvalId } = await params;
  const organisationId = requireOrganisationId(request);

  return withApprovalsRead(request, organisationId, async ({ requestId, tenant }) => {
    const item = await marketingApprovalService.getById(
      brandId,
      organisationId,
      approvalId,
      tenant!,
    );
    return apiSuccess({ item }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, approvalId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(marketingApprovalDecisionSchema, await jsonBody(request));

  return withApprovalsDecide(request, organisationId, async ({ requestId, tenant }) => {
    const item = await marketingApprovalService.decide(
      brandId,
      organisationId,
      approvalId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess({ item }, { requestId });
  });
}
