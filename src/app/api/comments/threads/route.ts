import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withNotificationsRead,
  withNotificationsWrite,
} from "@/lib/api/notifications-handler";
import { commentThreadService } from "@/server/services/comment-thread-service";

export async function POST(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withNotificationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const thread = await commentThreadService.getOrCreateThread(organisationId, {
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      projectId: body.projectId,
      brandId: body.brandId,
    });
    return apiSuccess({ thread }, { requestId });
  });
}

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const resourceType = request.nextUrl.searchParams.get("resourceType");
  const resourceId = request.nextUrl.searchParams.get("resourceId");
  if (!resourceType || !resourceId) {
    return apiSuccess({ error: "resourceType and resourceId required" }, { requestId: "missing" });
  }
  return withNotificationsRead(request, organisationId, async ({ requestId, tenant }) => {
    const thread = await commentThreadService.getOrCreateThread(organisationId, {
      resourceType,
      resourceId,
    });
    const comments = await commentThreadService.listComments(organisationId, thread.id, tenant!);
    return apiSuccess(comments, { requestId });
  });
}
