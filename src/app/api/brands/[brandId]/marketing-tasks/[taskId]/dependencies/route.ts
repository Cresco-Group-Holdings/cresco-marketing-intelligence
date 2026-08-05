import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withOperationsWrite,
} from "@/lib/api/operations-handler";
import { marketingTaskDependencySchema } from "@/lib/validation/marketing-tasks";
import { marketingTaskService } from "@/server/services/marketing-task-service";

type Params = { params: Promise<{ brandId: string; taskId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, taskId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(marketingTaskDependencySchema, await jsonBody(request));

  return withOperationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const item = await marketingTaskService.addDependency(
      brandId,
      organisationId,
      taskId,
      body.dependsOnTaskId,
      tenant!,
    );
    return apiSuccess({ item }, { requestId });
  });
}
