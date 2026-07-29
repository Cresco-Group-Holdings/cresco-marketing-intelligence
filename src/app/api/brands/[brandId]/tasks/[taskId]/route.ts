import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withOperationsRead,
  withOperationsWrite,
} from "@/lib/api/operations-handler";
import { taskUpdateSchema } from "@/lib/validation/operations";
import { contentOperationsService } from "@/server/services/content-operations-service";

type Params = { params: Promise<{ brandId: string; taskId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId, taskId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(taskUpdateSchema, await jsonBody(request));

  return withOperationsWrite(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await contentOperationsService.updateTask(brandId, organisationId, taskId, body, tenant!),
      { requestId },
    ),
  );
}

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, taskId } = await params;
  const organisationId = requireOrganisationId(request);

  return withOperationsRead(request, organisationId, async ({ requestId, tenant }) => {
    const tasks = await contentOperationsService.listTasks(
      brandId,
      organisationId,
      {},
      tenant!,
    );
    const task = tasks.find((item) => item.id === taskId);
    return apiSuccess(task ?? null, { requestId });
  });
}
