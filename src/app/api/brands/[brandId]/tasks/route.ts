import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  operationsFilters,
  requireOrganisationId,
  withOperationsRead,
  withOperationsWrite,
} from "@/lib/api/operations-handler";
import { taskCreateSchema } from "@/lib/validation/operations";
import { contentOperationsService } from "@/server/services/content-operations-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const filters = operationsFilters(request);

  return withOperationsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await contentOperationsService.listTasks(brandId, organisationId, filters, tenant!),
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(taskCreateSchema, await jsonBody(request));

  return withOperationsWrite(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await contentOperationsService.createTask(brandId, organisationId, body, tenant!),
      { requestId },
    ),
  );
}
