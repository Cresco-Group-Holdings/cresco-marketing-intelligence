import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withOperationsWrite,
} from "@/lib/api/operations-handler";
import { marketingTaskChecklistUpdateSchema } from "@/lib/validation/marketing-tasks";
import { marketingTaskService } from "@/server/services/marketing-task-service";

type Params = { params: Promise<{ brandId: string; taskId: string; itemId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId, taskId, itemId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(marketingTaskChecklistUpdateSchema, await jsonBody(request));

  return withOperationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const item = await marketingTaskService.updateChecklistItem(
      brandId,
      organisationId,
      taskId,
      itemId,
      body.isCompleted,
      tenant!,
    );
    return apiSuccess({ item }, { requestId });
  });
}
