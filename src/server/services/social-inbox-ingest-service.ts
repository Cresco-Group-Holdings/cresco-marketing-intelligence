import { createHash } from "node:crypto";
import type { Prisma, SocialSafetyFlag } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { detectSafetyFlags, requiresHumanReview } from "@/lib/inbox/safety";
import type {
  IngestBatch,
  IngestComment,
  IngestConversation,
  IngestMention,
  IngestMessage,
  IngestParticipant,
  InboxAccountScope,
} from "@/lib/inbox/types";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

type IngestResult = {
  participantsUpserted: number;
  conversationsUpserted: number;
  messagesUpserted: number;
  commentsUpserted: number;
  mentionsUpserted: number;
  skipped: boolean;
};

function mergeSafetyFlags(existing: SocialSafetyFlag[], incoming: SocialSafetyFlag[]): SocialSafetyFlag[] {
  return [...new Set([...existing, ...incoming])];
}

async function upsertParticipant(scope: InboxAccountScope, input: IngestParticipant) {
  return prisma.socialParticipant.upsert({
    where: {
      socialAccountId_providerParticipantId: {
        socialAccountId: scope.socialAccountId,
        providerParticipantId: input.providerParticipantId,
      },
    },
    create: {
      ...scope,
      providerParticipantId: input.providerParticipantId,
      displayName: input.displayName,
      username: input.username,
      profileUrl: input.profileUrl,
      avatarUrl: input.avatarUrl,
      providerMetadata: input.providerMetadata as Prisma.InputJsonValue | undefined,
    },
    update: {
      displayName: input.displayName,
      username: input.username,
      profileUrl: input.profileUrl,
      avatarUrl: input.avatarUrl,
      providerMetadata: input.providerMetadata as Prisma.InputJsonValue | undefined,
    },
  });
}

async function resolveParticipantId(
  scope: InboxAccountScope,
  providerParticipantId: string | undefined,
  participantCache: Map<string, string>,
) {
  if (!providerParticipantId) return null;
  const cached = participantCache.get(providerParticipantId);
  if (cached) return cached;
  const participant = await prisma.socialParticipant.findUnique({
    where: {
      socialAccountId_providerParticipantId: {
        socialAccountId: scope.socialAccountId,
        providerParticipantId,
      },
    },
    select: { id: true },
  });
  return participant?.id ?? null;
}

async function resolveConversationId(
  scope: InboxAccountScope,
  providerConversationId: string | undefined,
  cache: Map<string, string>,
): Promise<string | null> {
  if (!providerConversationId) return null;
  const cached = cache.get(providerConversationId);
  if (cached) return cached;
  const conversation = await prisma.socialConversation.findUnique({
    where: {
      socialAccountId_providerConversationId: {
        socialAccountId: scope.socialAccountId,
        providerConversationId,
      },
    },
    select: { id: true },
  });
  return conversation?.id ?? null;
}

async function upsertConversation(
  scope: InboxAccountScope,
  input: IngestConversation,
  safetyFlags: SocialSafetyFlag[],
) {
  const requiresReview = requiresHumanReview(safetyFlags);
  return prisma.socialConversation.upsert({
    where: {
      socialAccountId_providerConversationId: {
        socialAccountId: scope.socialAccountId,
        providerConversationId: input.providerConversationId,
      },
    },
    create: {
      ...scope,
      providerConversationId: input.providerConversationId,
      conversationType: input.conversationType,
      subject: input.subject,
      summary: input.summary,
      relatedProviderPostId: input.relatedProviderPostId,
      relatedContentItemId: input.relatedContentItemId,
      safetyFlags,
      requiresHumanReview: requiresReview,
      providerMetadata: input.providerMetadata as Prisma.InputJsonValue | undefined,
    },
    update: {
      subject: input.subject,
      summary: input.summary,
      relatedProviderPostId: input.relatedProviderPostId,
      relatedContentItemId: input.relatedContentItemId,
      safetyFlags,
      requiresHumanReview: requiresReview,
      providerMetadata: input.providerMetadata as Prisma.InputJsonValue | undefined,
    },
  });
}

async function upsertMessage(
  scope: InboxAccountScope,
  conversationId: string,
  input: IngestMessage,
  participantId: string | null,
) {
  const existing = await prisma.socialMessage.findUnique({
    where: {
      conversationId_providerMessageId: {
        conversationId,
        providerMessageId: input.providerMessageId,
      },
    },
  });
  if (existing && !input.isEdited && !input.isDeleted) {
    return existing;
  }

  return prisma.socialMessage.upsert({
    where: {
      conversationId_providerMessageId: {
        conversationId,
        providerMessageId: input.providerMessageId,
      },
    },
    create: {
      ...scope,
      conversationId,
      participantId,
      providerMessageId: input.providerMessageId,
      direction: input.direction,
      body: input.isDeleted ? "[deleted]" : input.body,
      bodyHtml: input.bodyHtml,
      isDeleted: input.isDeleted ?? false,
      isEdited: input.isEdited ?? false,
      providerCreatedAt: input.providerCreatedAt,
      providerEditedAt: input.providerEditedAt,
      providerMetadata: input.providerMetadata as Prisma.InputJsonValue | undefined,
    },
    update: {
      body: input.isDeleted ? "[deleted]" : input.body,
      bodyHtml: input.bodyHtml,
      isDeleted: input.isDeleted ?? false,
      isEdited: input.isEdited ?? false,
      providerEditedAt: input.providerEditedAt,
      participantId,
      providerMetadata: input.providerMetadata as Prisma.InputJsonValue | undefined,
    },
  });
}

async function upsertComment(
  scope: InboxAccountScope,
  input: IngestComment,
  conversationId: string | null,
  participantId: string | null,
) {
  return prisma.socialComment.upsert({
    where: {
      socialAccountId_providerCommentId: {
        socialAccountId: scope.socialAccountId,
        providerCommentId: input.providerCommentId,
      },
    },
    create: {
      ...scope,
      conversationId,
      participantId,
      providerCommentId: input.providerCommentId,
      providerPostId: input.providerPostId,
      parentCommentId: input.parentCommentId,
      body: input.isDeleted ? "[deleted]" : input.body,
      isHidden: input.isHidden ?? false,
      isDeleted: input.isDeleted ?? false,
      providerCreatedAt: input.providerCreatedAt,
      providerEditedAt: input.providerEditedAt,
      providerMetadata: input.providerMetadata as Prisma.InputJsonValue | undefined,
    },
    update: {
      conversationId,
      participantId,
      body: input.isDeleted ? "[deleted]" : input.body,
      isHidden: input.isHidden ?? false,
      isDeleted: input.isDeleted ?? false,
      providerEditedAt: input.providerEditedAt,
      providerMetadata: input.providerMetadata as Prisma.InputJsonValue | undefined,
    },
  });
}

async function upsertMention(
  scope: InboxAccountScope,
  input: IngestMention,
  conversationId: string | null,
  participantId: string | null,
) {
  return prisma.socialMention.upsert({
    where: {
      socialAccountId_providerMentionId: {
        socialAccountId: scope.socialAccountId,
        providerMentionId: input.providerMentionId,
      },
    },
    create: {
      ...scope,
      conversationId,
      participantId,
      providerMentionId: input.providerMentionId,
      providerPostId: input.providerPostId,
      body: input.body,
      providerCreatedAt: input.providerCreatedAt,
      providerMetadata: input.providerMetadata as Prisma.InputJsonValue | undefined,
    },
    update: {
      conversationId,
      participantId,
      body: input.body,
      providerPostId: input.providerPostId,
      providerMetadata: input.providerMetadata as Prisma.InputJsonValue | undefined,
    },
  });
}

async function touchConversation(
  conversationId: string,
  input: { lastMessageAt: Date; inbound?: boolean; safetyFlags?: SocialSafetyFlag[] },
) {
  const existing = await prisma.socialConversation.findUnique({
    where: { id: conversationId },
    select: { unreadCount: true, safetyFlags: true },
  });
  if (!existing) return;

  const safetyFlags = input.safetyFlags
    ? mergeSafetyFlags(existing.safetyFlags, input.safetyFlags)
    : existing.safetyFlags;

  await prisma.socialConversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: input.lastMessageAt,
      lastInboundAt: input.inbound ? input.lastMessageAt : undefined,
      unreadCount: input.inbound ? { increment: 1 } : undefined,
      safetyFlags,
      requiresHumanReview: requiresHumanReview(safetyFlags),
    },
  });
}

async function ensureCommentConversation(
  scope: InboxAccountScope,
  comment: IngestComment,
  flags: SocialSafetyFlag[],
  cache: Map<string, string>,
): Promise<{ id: string; created: boolean }> {
  const providerConversationId =
    comment.providerConversationId ?? `comment-thread:${comment.providerPostId}`;
  const existing = cache.get(providerConversationId);
  if (existing) {
    return { id: existing, created: false };
  }
  const persisted = await prisma.socialConversation.findUnique({
    where: {
      socialAccountId_providerConversationId: {
        socialAccountId: scope.socialAccountId,
        providerConversationId,
      },
    },
    select: { id: true },
  });
  if (persisted) {
    cache.set(providerConversationId, persisted.id);
    return { id: persisted.id, created: false };
  }
  const row = await upsertConversation(
    scope,
    {
      providerConversationId,
      conversationType: "COMMENT",
      relatedProviderPostId: comment.providerPostId,
      summary: comment.body.slice(0, 280),
    },
    flags,
  );
  cache.set(providerConversationId, row.id);
  return { id: row.id, created: true };
}

export const socialInboxIngestService = {
  /** Idempotent ingest keyed by batch idempotencyKey; deduplicates on provider entity ids. */
  async ingestBatch(scope: InboxAccountScope, batch: IngestBatch): Promise<IngestResult> {
    const batchKey = digest(`${scope.socialAccountId}:${batch.idempotencyKey}`);
    const marker = await prisma.socialInboxWebhookEvent.findFirst({
      where: {
        socialAccountId: scope.socialAccountId,
        idempotencyKey: batchKey,
        status: "PROCESSED",
      },
    });
    if (marker) {
      return {
        participantsUpserted: 0,
        conversationsUpserted: 0,
        messagesUpserted: 0,
        commentsUpserted: 0,
        mentionsUpserted: 0,
        skipped: true,
      };
    }

    const participantCache = new Map<string, string>();
    const conversationCache = new Map<string, string>();
    let participantsUpserted = 0;
    let conversationsUpserted = 0;

    for (const participant of batch.participants ?? []) {
      const row = await upsertParticipant(scope, participant);
      participantCache.set(participant.providerParticipantId, row.id);
      participantsUpserted += 1;
    }

    for (const conversation of batch.conversations ?? []) {
      const flags = detectSafetyFlags(conversation.summary ?? conversation.subject ?? "");
      const row = await upsertConversation(scope, conversation, flags);
      conversationCache.set(conversation.providerConversationId, row.id);
      conversationsUpserted += 1;
    }

    let messagesUpserted = 0;
    for (const message of batch.messages ?? []) {
      let conversationId = await resolveConversationId(
        scope,
        message.providerConversationId,
        conversationCache,
      );
      if (!conversationId && message.providerConversationId) {
        const flags = detectSafetyFlags(message.body);
        const row = await upsertConversation(
          scope,
          {
            providerConversationId: message.providerConversationId,
            conversationType: "DIRECT_MESSAGE",
            summary: message.body.slice(0, 280),
          },
          flags,
        );
        conversationCache.set(message.providerConversationId, row.id);
        conversationId = row.id;
        conversationsUpserted += 1;
      }
      if (!conversationId) continue;

      const participantId = await resolveParticipantId(
        scope,
        message.providerParticipantId,
        participantCache,
      );
      const flags = detectSafetyFlags(message.body);
      await upsertMessage(scope, conversationId, message, participantId);
      await touchConversation(conversationId, {
        lastMessageAt: message.providerCreatedAt,
        inbound: message.direction === "INBOUND" && !message.isDeleted,
        safetyFlags: flags,
      });
      messagesUpserted += 1;
    }

    let commentsUpserted = 0;
    for (const comment of batch.comments ?? []) {
      const flags = detectSafetyFlags(comment.body);
      const { id: conversationId, created } = await ensureCommentConversation(
        scope,
        comment,
        flags,
        conversationCache,
      );
      if (created) {
        conversationsUpserted += 1;
      }
      const participantId = await resolveParticipantId(
        scope,
        comment.providerParticipantId,
        participantCache,
      );
      await upsertComment(scope, comment, conversationId, participantId);
      await touchConversation(conversationId, {
        lastMessageAt: comment.providerCreatedAt,
        inbound: !comment.isDeleted,
        safetyFlags: flags,
      });
      commentsUpserted += 1;
    }

    let mentionsUpserted = 0;
    for (const mention of batch.mentions ?? []) {
      let conversationId = await resolveConversationId(
        scope,
        mention.providerConversationId,
        conversationCache,
      );
      if (!conversationId && mention.providerConversationId) {
        const flags = detectSafetyFlags(mention.body);
        const row = await upsertConversation(
          scope,
          {
            providerConversationId: mention.providerConversationId,
            conversationType: "MENTION",
            relatedProviderPostId: mention.providerPostId,
            summary: mention.body.slice(0, 280),
          },
          flags,
        );
        conversationCache.set(mention.providerConversationId, row.id);
        conversationId = row.id;
        conversationsUpserted += 1;
      }
      const participantId = await resolveParticipantId(
        scope,
        mention.providerParticipantId,
        participantCache,
      );
      await upsertMention(scope, mention, conversationId, participantId);
      if (conversationId) {
        await touchConversation(conversationId, {
          lastMessageAt: mention.providerCreatedAt,
          inbound: true,
          safetyFlags: detectSafetyFlags(mention.body),
        });
      }
      mentionsUpserted += 1;
    }

    await prisma.socialInboxWebhookEvent.upsert({
      where: {
        socialAccountId_idempotencyKey: {
          socialAccountId: scope.socialAccountId,
          idempotencyKey: batchKey,
        },
      },
      create: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        socialAccountId: scope.socialAccountId,
        provider: scope.provider,
        idempotencyKey: batchKey,
        payloadDigest: batchKey,
        status: "PROCESSED",
        processedAt: new Date(),
      },
      update: {
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

    return {
      participantsUpserted,
      conversationsUpserted,
      messagesUpserted,
      commentsUpserted,
      mentionsUpserted,
      skipped: false,
    };
  },
};
