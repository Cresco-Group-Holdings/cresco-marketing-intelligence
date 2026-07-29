import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withOperationsRead,
  withOperationsWrite,
} from "@/lib/api/operations-handler";
import {
  assignmentCreateSchema,
  checklistItemUpdateSchema,
  deadlineCreateSchema,
} from "@/lib/validation/operations";
import { contentOperationsService } from "@/server/services/content-operations-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);

  return withOperationsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await contentOperationsService.getOperationsOverview(brandId, organisationId, tenant!),
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const action = request.nextUrl.searchParams.get("action");
  const body = parseBody(
    action === "assign"
      ? assignmentCreateSchema
      : action === "deadline"
        ? deadlineCreateSchema
        : checklistItemUpdateSchema,
    await jsonBody(request),
  );

  return withOperationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    if (action === "assign") {
      return apiSuccess(
        await contentOperationsService.assignRole(
          brandId,
          organisationId,
          body as Parameters<typeof contentOperationsService.assignRole>[2],
          tenant!,
        ),
        { requestId },
      );
    }
    if (action === "deadline") {
      return apiSuccess(
        await contentOperationsService.createDeadline(
          brandId,
          organisationId,
          body as Parameters<typeof contentOperationsService.createDeadline>[2],
          tenant!,
        ),
        { requestId },
      );
    }
    const itemId = request.nextUrl.searchParams.get("itemId");
    if (!itemId) {
      throw new Error("itemId is required for checklist updates.");
    }
    return apiSuccess(
      await contentOperationsService.updateChecklistItem(
        brandId,
        organisationId,
        itemId,
        (body as { isCompleted: boolean }).isCompleted,
        tenant!,
      ),
      { requestId },
    );
  });
}
