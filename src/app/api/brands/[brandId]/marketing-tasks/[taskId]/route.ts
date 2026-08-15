import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withOperationsRead,
  withOperationsWrite,
} from "@/lib/api/operations-handler";
import {
  marketingTaskUpdateSchema,
  marketingTaskStatusTransitionSchema,
} from "@/lib/validation/marketing-tasks";
import { marketingTaskService } from "@/server/services/marketing-task-service";

type Params = { params: Promise<{ brandId: string; taskId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, taskId } = await params;
  const organisationId = requireOrganisationId(request);

  return withOperationsRead(request, organisationId, async ({ requestId, tenant }) => {
    const item = await marketingTaskService.getById(brandId, organisationId, taskId, tenant!);
    return apiSuccess({ item }, { requestId });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId, taskId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(marketingTaskUpdateSchema, await jsonBody(request));

  return withOperationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const item = await marketingTaskService.update(
      brandId,
      organisationId,
      taskId,
      body,
      tenant!,
      requestId,
    );
    return apiSuccess({ item }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, taskId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(marketingTaskStatusTransitionSchema, await jsonBody(request));

  return withOperationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const item = await marketingTaskService.update(
      brandId,
      organisationId,
      taskId,
      { status: body.status },
      tenant!,
      requestId,
    );
    return apiSuccess({ item }, { requestId });
  });
}
