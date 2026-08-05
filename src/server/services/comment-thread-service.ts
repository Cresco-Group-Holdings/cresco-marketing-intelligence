import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  parseMentionedUserIds,
  renderSafeMarkdown,
  sanitizeCommentBody,
} from "@/lib/collaboration/mention-parser";
import type { TenantContext } from "@/lib/tenancy/context";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";
import { notificationService } from "@/server/services/notification-service";
import { unifiedInboxService } from "@/server/services/unified-inbox-service";

export const commentThreadService = {
  async getOrCreateThread(
    organisationId: string,
    input: { resourceType: string; resourceId: string; projectId?: string; brandId?: string },
  ) {
    const existing = await prisma.commentThread.findUnique({
      where: {
        organisationId_resourceType_resourceId: {
          organisationId,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
        },
      },
    });
    if (existing) return existing;

    return prisma.commentThread.create({
      data: {
        organisationId,
        projectId: input.projectId,
        brandId: input.brandId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      },
    });
  },

  async listComments(organisationId: string, threadId: string, context: TenantContext) {
    const thread = await prisma.commentThread.findFirst({
      where: { id: threadId, organisationId },
    });
    if (!thread) throw new AppError("NOT_FOUND", "Comment thread not found.");

    const comments = await prisma.collaborationComment.findMany({
      where: { threadId, organisationId, deletedAt: null },
      include: {
        author: { select: { id: true, displayName: true } },
        mentions: { include: { mentionedUser: { select: { id: true, displayName: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      thread: { id: thread.id, status: thread.status, resourceType: thread.resourceType, resourceId: thread.resourceId },
      comments: comments.map((comment) => ({
        id: comment.id,
        body: comment.sanitizedBody,
        html: renderSafeMarkdown(comment.sanitizedBody),
        author: comment.author,
        mentions: comment.mentions.map((m) => m.mentionedUser),
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
      })),
    };
  },

  async addComment(
    organisationId: string,
    threadId: string,
    body: string,
    context: TenantContext,
    options?: { attachmentRefs?: string[] },
  ) {
    if (!hasPermission(context.organisationRole, PERMISSIONS["content.edit"])) {
      throw new AppError("FORBIDDEN", "Insufficient permission to comment.");
    }

    const thread = await prisma.commentThread.findFirst({
      where: { id: threadId, organisationId },
    });
    if (!thread) throw new AppError("NOT_FOUND", "Comment thread not found.");

    const sanitized = sanitizeCommentBody(body);
    const comment = await prisma.collaborationComment.create({
      data: {
        organisationId,
        threadId,
        authorUserId: context.userProfileId,
        body,
        sanitizedBody: sanitized,
        attachmentRefs: options?.attachmentRefs ?? [],
      },
    });

    const mentionedIds = parseMentionedUserIds(body);
    const validMentions: string[] = [];
    for (const mentionedUserId of mentionedIds) {
      const member = await prisma.organisationMembership.findFirst({
        where: { organisationId, userId: mentionedUserId },
      });
      if (!member || mentionedUserId === context.userProfileId) continue;

      await prisma.userMention.create({
        data: {
          organisationId,
          commentId: comment.id,
          mentionedUserId,
          mentionedByUserId: context.userProfileId,
        },
      });
      validMentions.push(mentionedUserId);
    }

    for (const recipientId of validMentions) {
      const idempotencyKey = `mention:${comment.id}:${recipientId}`;
      const emitted = await notificationService.emit({
        organisationId,
        projectId: thread.projectId ?? undefined,
        brandId: thread.brandId ?? undefined,
        eventType: "collaboration.mention",
        title: "You were mentioned",
        body: sanitized.slice(0, 200),
        resourceType: thread.resourceType,
        resourceId: thread.resourceId,
        actionPath: `/${thread.resourceType}/${thread.resourceId}`,
        recipientUserIds: [recipientId],
        idempotencyKey,
        priority: "NORMAL",
      });

      for (const result of emitted) {
        await unifiedInboxService.upsertFromNotification({
          organisationId,
          userId: recipientId,
          category: "INBOX",
          eventType: "collaboration.mention",
          title: "You were mentioned",
          message: sanitized.slice(0, 200),
          sourceEntityType: thread.resourceType,
          sourceEntityId: thread.resourceId,
          notificationId: result.notification.id,
          idempotencyKey,
        });
      }
    }

    return comment;
  },

  async resolveThread(organisationId: string, threadId: string, context: TenantContext) {
    const thread = await prisma.commentThread.findFirst({
      where: { id: threadId, organisationId },
    });
    if (!thread) throw new AppError("NOT_FOUND", "Comment thread not found.");

    return prisma.commentThread.update({
      where: { id: threadId },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolvedByUserId: context.userProfileId,
      },
    });
  },

  async softDeleteComment(organisationId: string, commentId: string, context: TenantContext) {
    const comment = await prisma.collaborationComment.findFirst({
      where: { id: commentId, organisationId },
    });
    if (!comment) throw new AppError("NOT_FOUND", "Comment not found.");
    if (comment.authorUserId !== context.userProfileId && !hasPermission(context.organisationRole, PERMISSIONS["content.approve"])) {
      throw new AppError("FORBIDDEN", "Cannot delete this comment.");
    }

    return prisma.collaborationComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date(), body: "[deleted]", sanitizedBody: "[deleted]" },
    });
  },
};
