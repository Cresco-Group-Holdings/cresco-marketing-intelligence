import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withOperationsWrite,
} from "@/lib/api/operations-handler";
import { marketingTaskService } from "@/server/services/marketing-task-service";

type Params = { params: Promise<{ brandId: string; taskId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, taskId } = await params;
  const organisationId = requireOrganisationId(request);

  return withOperationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const result = await marketingTaskService.complete(
      brandId,
      organisationId,
      taskId,
      tenant!,
      requestId,
    );
    return apiSuccess({ item: result }, { requestId });
  });
}
