import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withInboxReply } from "@/lib/api/inbox-handler";
import { AppError } from "@/lib/errors";
import { inboxReplySchema } from "@/lib/validation/inbox";
import { socialInboxReplyService } from "@/server/services/social-inbox-reply-service";

type Params = { params: Promise<{ brandId: string; conversationId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, conversationId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(inboxReplySchema, await jsonBody(request));
  const socialAccountId =
    request.nextUrl.searchParams.get("socialAccountId") ??
    request.headers.get("x-social-account-id");

  if (!socialAccountId) {
    throw new AppError("VALIDATION_ERROR", "socialAccountId is required.");
  }

  return withInboxReply(request, organisationId, async ({ requestId, tenant }) => {
    const message = await socialInboxReplyService.sendReply(
      brandId,
      organisationId,
      conversationId,
      { socialAccountId, body: body.body },
      tenant!,
    );
    return apiSuccess({ message }, { requestId });
  });
}
