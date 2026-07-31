import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withInboxAssign,
  withInboxModerate,
  withInboxReply,
  withInboxResolve,
} from "@/lib/api/inbox-handler";
import { AppError } from "@/lib/errors";
import {
  inboxAiSuggestSchema,
  inboxAssignSchema,
  inboxCopySchema,
  inboxDraftSchema,
  inboxHideSchema,
  inboxReplySchema,
  inboxResolveSchema,
  inboxSocialAccountSchema,
  inboxStatusUpdateSchema,
  inboxTagSchema,
} from "@/lib/validation/inbox";
import { inboxReplySuggestionService } from "@/server/services/inbox-reply-suggestion-service";
import { socialInboxReplyService } from "@/server/services/social-inbox-reply-service";

type Params = { params: Promise<{ brandId: string; conversationId: string }> };

const ACTIONS = [
  "reply",
  "draft",
  "assign",
  "tag",
  "status",
  "hide",
  "resolve",
  "suggest",
  "copy",
] as const;

type InboxAction = (typeof ACTIONS)[number];

function parseAction(request: NextRequest): InboxAction {
  const action = request.nextUrl.searchParams.get("action");
  if (!action || !ACTIONS.includes(action as InboxAction)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Action must be one of: ${ACTIONS.join(", ")}.`,
    );
  }
  return action as InboxAction;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, conversationId } = await params;
  const organisationId = requireOrganisationId(request);
  const action = parseAction(request);
  const rawBody = await jsonBody(request);

  switch (action) {
    case "reply": {
      const body = parseBody(inboxReplySchema.merge(inboxSocialAccountSchema), rawBody);
      return withInboxReply(request, organisationId, async ({ requestId, tenant }) =>
        apiSuccess(
          {
            message: await socialInboxReplyService.sendReply(
              brandId,
              organisationId,
              conversationId,
              body,
              tenant!,
            ),
          },
          { requestId },
        ),
      );
    }
    case "draft": {
      const body = parseBody(inboxDraftSchema.merge(inboxSocialAccountSchema), rawBody);
      return withInboxReply(request, organisationId, async ({ requestId, tenant }) =>
        apiSuccess(
          {
            draft: await socialInboxReplyService.saveDraft(
              brandId,
              organisationId,
              conversationId,
              { ...body, socialAccountId: body.socialAccountId },
              tenant!,
            ),
          },
          { requestId },
        ),
      );
    }
    case "copy": {
      const body = parseBody(inboxCopySchema.merge(inboxSocialAccountSchema), rawBody);
      return withInboxReply(request, organisationId, async ({ requestId, tenant }) =>
        apiSuccess(
          await socialInboxReplyService.copyReplyText(
            brandId,
            organisationId,
            conversationId,
            body,
            tenant!,
          ),
          { requestId },
        ),
      );
    }
    case "assign": {
      const body = parseBody(inboxAssignSchema.merge(inboxSocialAccountSchema), rawBody);
      return withInboxAssign(request, organisationId, async ({ requestId, tenant }) =>
        apiSuccess(
          {
            assignment: await socialInboxReplyService.assign(
              brandId,
              organisationId,
              conversationId,
              body,
              tenant!,
            ),
          },
          { requestId },
        ),
      );
    }
    case "tag": {
      const body = parseBody(inboxTagSchema.merge(inboxSocialAccountSchema), rawBody);
      return withInboxAssign(request, organisationId, async ({ requestId, tenant }) =>
        apiSuccess(
          {
            tag: await socialInboxReplyService.addTag(
              brandId,
              organisationId,
              conversationId,
              body,
              tenant!,
            ),
          },
          { requestId },
        ),
      );
    }
    case "status": {
      const body = parseBody(inboxStatusUpdateSchema.merge(inboxSocialAccountSchema), rawBody);
      return withInboxResolve(request, organisationId, async ({ requestId, tenant }) =>
        apiSuccess(
          {
            conversation: await socialInboxReplyService.updateStatus(
              brandId,
              organisationId,
              conversationId,
              body,
              tenant!,
            ),
          },
          { requestId },
        ),
      );
    }
    case "resolve": {
      const body = parseBody(inboxResolveSchema.merge(inboxSocialAccountSchema), rawBody);
      return withInboxResolve(request, organisationId, async ({ requestId, tenant }) =>
        apiSuccess(
          {
            conversation: await socialInboxReplyService.resolveConversation(
              brandId,
              organisationId,
              conversationId,
              body,
              tenant!,
            ),
          },
          { requestId },
        ),
      );
    }
    case "hide": {
      const body = parseBody(inboxHideSchema.merge(inboxSocialAccountSchema), rawBody);
      return withInboxModerate(request, organisationId, async ({ requestId, tenant }) =>
        apiSuccess(
          {
            comment: await socialInboxReplyService.hideComment(
              brandId,
              organisationId,
              conversationId,
              body,
              tenant!,
            ),
          },
          { requestId },
        ),
      );
    }
    case "suggest": {
      const body = parseBody(inboxAiSuggestSchema.merge(inboxSocialAccountSchema), rawBody);
      return withInboxReply(request, organisationId, async ({ requestId, tenant }) =>
        apiSuccess(
          await inboxReplySuggestionService.suggestReply(
            brandId,
            organisationId,
            conversationId,
            { socialAccountId: body.socialAccountId, requestId },
            tenant!,
          ),
          { requestId },
        ),
      );
    }
    default:
      throw new AppError("VALIDATION_ERROR", "Unsupported inbox action.");
  }
}
