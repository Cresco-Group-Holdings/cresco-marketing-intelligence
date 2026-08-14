import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withApprovalsRead,
} from "@/lib/api/approvals-handler";
import { marketingApprovalService } from "@/server/services/marketing-approval-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);

  return withApprovalsRead(request, organisationId, async ({ requestId, tenant }) => {
    const items = await marketingApprovalService.getInbox(brandId, organisationId, tenant!);
    return apiSuccess({ items }, { requestId });
  });
}
