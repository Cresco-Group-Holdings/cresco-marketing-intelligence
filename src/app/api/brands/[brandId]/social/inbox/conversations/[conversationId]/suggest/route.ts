import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withInboxReply } from "@/lib/api/inbox-handler";
import { AppError } from "@/lib/errors";
import { inboxAiSuggestSchema } from "@/lib/validation/inbox";
import { inboxReplySuggestionService } from "@/server/services/inbox-reply-suggestion-service";

type Params = { params: Promise<{ brandId: string; conversationId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, conversationId } = await params;
  const organisationId = requireOrganisationId(request);
  parseBody(inboxAiSuggestSchema, await jsonBody(request));
  const socialAccountId =
    request.nextUrl.searchParams.get("socialAccountId") ??
    request.headers.get("x-social-account-id");

  if (!socialAccountId) {
    throw new AppError("VALIDATION_ERROR", "socialAccountId is required.");
  }

  return withInboxReply(request, organisationId, async ({ requestId, tenant }) => {
    const suggestion = await inboxReplySuggestionService.suggestReply(
      brandId,
      organisationId,
      conversationId,
      { socialAccountId },
      tenant!,
    );
    return apiSuccess({ suggestion }, { requestId });
  });
}
