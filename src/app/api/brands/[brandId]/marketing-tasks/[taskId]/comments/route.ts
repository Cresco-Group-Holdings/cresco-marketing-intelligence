import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withOperationsWrite,
} from "@/lib/api/operations-handler";
import { marketingTaskCommentSchema } from "@/lib/validation/marketing-tasks";
import { marketingTaskService } from "@/server/services/marketing-task-service";

type Params = { params: Promise<{ brandId: string; taskId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, taskId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(marketingTaskCommentSchema, await jsonBody(request));

  return withOperationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const comment = await marketingTaskService.addComment(
      brandId,
      organisationId,
      taskId,
      body.body,
      tenant!,
    );
    return apiSuccess({ comment }, { requestId });
  });
}
