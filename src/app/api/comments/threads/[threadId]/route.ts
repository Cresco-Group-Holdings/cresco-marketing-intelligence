import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withNotificationsRead,
  withNotificationsWrite,
} from "@/lib/api/notifications-handler";
import { commentThreadService } from "@/server/services/comment-thread-service";

type Params = { params: Promise<{ threadId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { threadId } = await params;
  const organisationId = requireOrganisationId(request);
  return withNotificationsRead(request, organisationId, async ({ requestId, tenant }) => {
    const result = await commentThreadService.listComments(organisationId, threadId, tenant!);
    return apiSuccess(result, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { threadId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "resolve") {
    return withNotificationsWrite(request, organisationId, async ({ requestId, tenant }) => {
      const thread = await commentThreadService.resolveThread(organisationId, threadId, tenant!);
      return apiSuccess({ thread }, { requestId });
    });
  }

  return withNotificationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const comment = await commentThreadService.addComment(
      organisationId,
      threadId,
      body.body,
      tenant!,
      { attachmentRefs: body.attachmentRefs },
    );
    return apiSuccess({ comment }, { requestId });
  });
}
