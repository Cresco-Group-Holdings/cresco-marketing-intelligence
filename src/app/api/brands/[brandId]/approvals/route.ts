import { MarketingApprovalStatus, MarketingApprovalType } from "@prisma/client";
import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withApprovalsRead,
  withApprovalsDecide,
} from "@/lib/api/approvals-handler";
import {
  marketingApprovalCreateSchema,
  marketingApprovalListQuerySchema,
} from "@/lib/validation/marketing-approvals";
import { marketingApprovalService } from "@/server/services/marketing-approval-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseBody(marketingApprovalListQuerySchema, raw);

  return withApprovalsRead(request, organisationId, async ({ requestId, tenant }) => {
    const items = await marketingApprovalService.list(brandId, organisationId, tenant!, {
      status: filters.status as MarketingApprovalStatus | undefined,
      type: filters.type as MarketingApprovalType | undefined,
      entityType: filters.entityType,
      entityId: filters.entityId,
      myRequests: filters.myRequests,
      pendingOnly: filters.pendingOnly,
    });
    return apiSuccess({ items }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(marketingApprovalCreateSchema, await jsonBody(request));

  return withApprovalsRead(request, organisationId, async ({ requestId, tenant }) => {
    const item = await marketingApprovalService.create(
      brandId,
      organisationId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess({ item }, { requestId });
  });
}
