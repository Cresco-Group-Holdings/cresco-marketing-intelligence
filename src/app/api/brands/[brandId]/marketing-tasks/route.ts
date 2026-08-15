import { MarketingTaskStatus, MarketingTaskType } from "@prisma/client";
import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  operationsFilters,
  requireOrganisationId,
  withOperationsRead,
  withOperationsWrite,
} from "@/lib/api/operations-handler";
import { marketingTaskListQuerySchema, marketingTaskCreateSchema } from "@/lib/validation/marketing-tasks";
import { marketingTaskService } from "@/server/services/marketing-task-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseBody(marketingTaskListQuerySchema, raw);

  return withOperationsRead(request, organisationId, async ({ requestId, tenant }) => {
    const items = await marketingTaskService.list(brandId, organisationId, tenant!, {
      status: filters.status as MarketingTaskStatus | undefined,
      type: filters.type as MarketingTaskType | undefined,
      priority: filters.priority,
      assigneeUserId: filters.assigneeUserId,
      campaignId: filters.campaignId,
      sourceEntityType: filters.sourceEntityType,
      sourceEntityId: filters.sourceEntityId,
      overdueOnly: filters.overdueOnly,
      blockedOnly: filters.blockedOnly,
      myTasks: filters.myTasks ?? operationsFilters(request).myWork,
      search: filters.search,
    });
    return apiSuccess({ items }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(marketingTaskCreateSchema, await jsonBody(request));

  return withOperationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const item = await marketingTaskService.create(
      brandId,
      organisationId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess({ item }, { requestId });
  });
}
