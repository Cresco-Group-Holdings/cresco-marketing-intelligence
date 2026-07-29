import type { SocialConversationStatus } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { getSocialInboxAdapter } from "@/lib/inbox/adapters";
import { assertOrganisationScope, type TenantContext } from "@/lib/tenancy/context";
import { socialCredentialService } from "@/server/services/social-credential-service";
import { brandService } from "@/server/services/workspace-service";

async function loadConversation(
  brandId: string,
  organisationId: string,
  conversationId: string,
  context: TenantContext,
) {
  await brandService.getById(brandId, organisationId, context);
  const conversation = await prisma.socialConversation.findFirst({
    where: { id: conversationId, organisationId, brandId },
    include: {
      socialAccount: {
        include: {
          capabilities: true,
          socialConnection: true,
        },
      },
    },
  });
  if (!conversation) {
    throw new AppError("NOT_FOUND", "Conversation was not found.");
  }
  assertOrganisationScope(conversation.organisationId, context);
  return conversation;
}

export function assertConversationAccount(
  conversation: { socialAccountId: string },
  socialAccountId: string,
): void {
  if (conversation.socialAccountId !== socialAccountId) {
    throw new AppError(
      "FORBIDDEN",
      "The selected social account does not match this conversation.",
    );
  }
}

function assertManageComments(
  capabilities: Array<{ capability: string }>,
): void {
  if (!capabilities.some((item) => item.capability === "MANAGE_COMMENTS")) {
    throw new AppError("FORBIDDEN", "This account cannot manage comments.");
  }
}

export const socialInboxReplyService = {
    async saveDraft(
    brandId: string,
    organisationId: string,
    conversationId: string,
    input: { socialAccountId: string; body: string; aiGenerated?: boolean; aiRequestId?: string },
    context: TenantContext,
  ) {
    const conversation = await loadConversation(brandId, organisationId, conversationId, context);
    assertConversationAccount(conversation, input.socialAccountId);

    const existing = await prisma.socialInboxReplyDraft.findFirst({
      where: {
        conversationId,
        authorUserId: context.userProfileId,
        status: "DRAFT",
      },
    });

    if (existing) {
      return prisma.socialInboxReplyDraft.update({
        where: { id: existing.id },
        data: {
          body: input.body,
          aiGenerated: input.aiGenerated ?? false,
          aiRequestId: input.aiRequestId,
        },
      });
    }

    return prisma.socialInboxReplyDraft.create({
      data: {
        organisationId: conversation.organisationId,
        projectId: conversation.projectId,
        brandId: conversation.brandId,
        conversationId,
        authorUserId: context.userProfileId,
        body: input.body,
        aiGenerated: input.aiGenerated ?? false,
        aiRequestId: input.aiRequestId,
        status: "DRAFT",
      },
    });
  },

  async sendReply(
    brandId: string,
    organisationId: string,
    conversationId: string,
    input: { socialAccountId: string; body: string; draftId?: string },
    context: TenantContext,
  ) {
    const conversation = await loadConversation(brandId, organisationId, conversationId, context);
    assertConversationAccount(conversation, input.socialAccountId);
    assertManageComments(conversation.socialAccount.capabilities);

    const tokens = await socialCredentialService.readTokens(
      conversation.socialAccount.socialConnectionId,
    );
    if (!tokens) {
      throw new AppError("VALIDATION_ERROR", "Social credentials are unavailable.");
    }

    const adapter = getSocialInboxAdapter(conversation.provider);
    if (!adapter.sendReply) {
      throw new AppError("VALIDATION_ERROR", "Reply is not supported for this provider.");
    }

    const targetId =
      conversation.relatedProviderPostId ??
      conversation.providerConversationId;

    const sent = await adapter.sendReply({
      accessToken: tokens.accessToken,
      providerAccountId: conversation.socialAccount.providerAccountId,
      providerTargetId: targetId,
      body: input.body,
      replyType:
        conversation.conversationType === "DIRECT_MESSAGE"
          ? "MESSAGE"
          : conversation.conversationType === "MENTION"
            ? "MENTION"
            : "COMMENT",
    });

    const message = await prisma.socialMessage.create({
      data: {
        organisationId: conversation.organisationId,
        projectId: conversation.projectId,
        brandId: conversation.brandId,
        socialAccountId: conversation.socialAccountId,
        conversationId,
        providerMessageId: sent.providerMessageId,
        direction: "OUTBOUND",
        body: input.body,
        providerCreatedAt: new Date(),
        sentByUserId: context.userProfileId,
      },
    });

    if (input.draftId) {
      await prisma.socialInboxReplyDraft.updateMany({
        where: { id: input.draftId, conversationId, authorUserId: context.userProfileId },
        data: { status: "SENT" },
      });
    }

    await prisma.socialConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        status: conversation.status === "NEW" ? "OPEN" : conversation.status,
      },
    });

    return message;
  },

  async copyReplyText(
    brandId: string,
    organisationId: string,
    conversationId: string,
    input: { socialAccountId: string; body?: string; draftId?: string },
    context: TenantContext,
  ) {
    const conversation = await loadConversation(brandId, organisationId, conversationId, context);
    assertConversationAccount(conversation, input.socialAccountId);

    let body = input.body;
    if (!body && input.draftId) {
      const draft = await prisma.socialInboxReplyDraft.findFirst({
        where: {
          id: input.draftId,
          conversationId,
          authorUserId: context.userProfileId,
        },
      });
      if (!draft) {
        throw new AppError("NOT_FOUND", "Reply draft was not found.");
      }
      body = draft.body;
    }
    if (!body) {
      throw new AppError("VALIDATION_ERROR", "Reply text is required.");
    }

    return { body, manualFallback: true };
  },

  async hideComment(
    brandId: string,
    organisationId: string,
    conversationId: string,
    input: { socialAccountId: string; providerCommentId: string },
    context: TenantContext,
  ) {
    const conversation = await loadConversation(brandId, organisationId, conversationId, context);
    assertConversationAccount(conversation, input.socialAccountId);
    assertManageComments(conversation.socialAccount.capabilities);

    const comment = await prisma.socialComment.findFirst({
      where: {
        socialAccountId: input.socialAccountId,
        providerCommentId: input.providerCommentId,
        conversationId,
      },
    });
    if (!comment) {
      throw new AppError("NOT_FOUND", "Comment was not found.");
    }

    const tokens = await socialCredentialService.readTokens(
      conversation.socialAccount.socialConnectionId,
    );
    if (!tokens) {
      throw new AppError("VALIDATION_ERROR", "Social credentials are unavailable.");
    }

    const adapter = getSocialInboxAdapter(conversation.provider);
    if (adapter.hideComment) {
      await adapter.hideComment({
        accessToken: tokens.accessToken,
        providerAccountId: conversation.socialAccount.providerAccountId,
        providerCommentId: input.providerCommentId,
      });
    }

    return prisma.socialComment.update({
      where: { id: comment.id },
      data: { isHidden: true },
    });
  },

  async resolveConversation(
    brandId: string,
    organisationId: string,
    conversationId: string,
    input: { socialAccountId: string; reason?: string },
    context: TenantContext,
  ) {
    return this.updateStatus(
      brandId,
      organisationId,
      conversationId,
      { socialAccountId: input.socialAccountId, status: "RESOLVED", reason: input.reason },
      context,
    );
  },

  async assign(
    brandId: string,
    organisationId: string,
    conversationId: string,
    input: { socialAccountId: string; assignedToUserId: string; note?: string },
    context: TenantContext,
  ) {
    const conversation = await loadConversation(brandId, organisationId, conversationId, context);
    assertConversationAccount(conversation, input.socialAccountId);

    const membership = await prisma.organisationMembership.findFirst({
      where: {
        organisationId,
        userId: input.assignedToUserId,
        status: "ACTIVE",
      },
    });
    if (!membership) {
      throw new AppError("VALIDATION_ERROR", "Assignee is not an active organisation member.");
    }

    const [assignment] = await prisma.$transaction([
      prisma.socialInboxAssignment.create({
        data: {
          organisationId: conversation.organisationId,
          projectId: conversation.projectId,
          brandId: conversation.brandId,
          conversationId,
          assignedToUserId: input.assignedToUserId,
          assignedByUserId: context.userProfileId,
          note: input.note,
        },
      }),
      prisma.socialConversation.update({
        where: { id: conversationId },
        data: { assignedToUserId: input.assignedToUserId },
      }),
    ]);

    return assignment;
  },

  async addTag(
    brandId: string,
    organisationId: string,
    conversationId: string,
    input: { socialAccountId: string; tag: string },
    context: TenantContext,
  ) {
    const conversation = await loadConversation(brandId, organisationId, conversationId, context);
    assertConversationAccount(conversation, input.socialAccountId);

    return prisma.socialInboxTag.upsert({
      where: {
        conversationId_tag: {
          conversationId,
          tag: input.tag.trim().toLowerCase(),
        },
      },
      create: {
        organisationId: conversation.organisationId,
        projectId: conversation.projectId,
        brandId: conversation.brandId,
        conversationId,
        tag: input.tag.trim().toLowerCase(),
      },
      update: {},
    });
  },

  async updateStatus(
    brandId: string,
    organisationId: string,
    conversationId: string,
    input: { socialAccountId: string; status: SocialConversationStatus; reason?: string },
    context: TenantContext,
  ) {
    const conversation = await loadConversation(brandId, organisationId, conversationId, context);
    assertConversationAccount(conversation, input.socialAccountId);

    const [updated] = await prisma.$transaction([
      prisma.socialConversation.update({
        where: { id: conversationId },
        data: {
          status: input.status,
          resolvedAt: input.status === "RESOLVED" ? new Date() : null,
        },
      }),
      prisma.socialInboxStatusHistory.create({
        data: {
          organisationId: conversation.organisationId,
          projectId: conversation.projectId,
          brandId: conversation.brandId,
          conversationId,
          fromStatus: conversation.status,
          toStatus: input.status,
          changedByUserId: context.userProfileId,
          reason: input.reason,
        },
      }),
    ]);

    return updated;
  },
};
