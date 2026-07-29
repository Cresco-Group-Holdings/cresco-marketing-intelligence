import type { SocialProvider } from "@prisma/client";
import type { IngestBatch } from "@/lib/inbox/types";

type MetaWebhookValue = {
  id?: string;
  comment_id?: string;
  text?: string;
  message?: string;
  from?: { id?: string; username?: string; name?: string };
  media?: { id?: string };
  post_id?: string;
  created_time?: number | string;
  parent_id?: string;
};

type MetaWebhookChange = {
  field?: string;
  value?: MetaWebhookValue;
};

type MetaWebhookEntry = {
  id?: string;
  changes?: MetaWebhookChange[];
  messaging?: Array<{
    sender?: { id?: string };
    message?: { mid?: string; text?: string };
    timestamp?: number;
  }>;
};

type MetaWebhookPayload = {
  object?: string;
  entry?: MetaWebhookEntry[];
};

type XWebhookPayload = {
  tweet_create_events?: Array<{
    id_str?: string;
    text?: string;
    created_at?: string;
    in_reply_to_status_id_str?: string;
    user?: { id_str?: string; screen_name?: string; name?: string };
  }>;
  direct_message_events?: Array<{
    id?: string;
    created_timestamp?: string;
    message_create?: {
      sender_id?: string;
      message_data?: { text?: string };
    };
  }>;
};

function parseTimestamp(value: number | string | undefined): Date {
  if (typeof value === "number") {
    return new Date(value > 1_000_000_000_000 ? value : value * 1_000);
  }
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return parseTimestamp(numeric);
    }
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }
  }
  return new Date();
}

function metaParticipant(from: MetaWebhookValue["from"]) {
  if (!from?.id) return undefined;
  return {
    providerParticipantId: from.id,
    username: from.username,
    displayName: from.name ?? from.username,
  };
}

function parseMetaPayload(payload: MetaWebhookPayload): Omit<IngestBatch, "idempotencyKey"> {
  const participants: NonNullable<IngestBatch["participants"]> = [];
  const comments: NonNullable<IngestBatch["comments"]> = [];
  const mentions: NonNullable<IngestBatch["mentions"]> = [];
  const messages: NonNullable<IngestBatch["messages"]> = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;

      const participant = metaParticipant(value.from);
      if (participant) {
        participants.push(participant);
      }

      const body = value.text ?? value.message ?? "";
      const createdAt = parseTimestamp(value.created_time);
      const postId = value.media?.id ?? value.post_id;
      const commentId = value.comment_id ?? value.id;

      if (change.field === "comments" && commentId && postId) {
        comments.push({
          providerCommentId: commentId,
          providerPostId: postId,
          providerConversationId: `${postId}:comments`,
          providerParticipantId: value.from?.id,
          parentCommentId: value.parent_id,
          body,
          providerCreatedAt: createdAt,
        });
        continue;
      }

      if (change.field === "mentions" && commentId) {
        mentions.push({
          providerMentionId: commentId,
          providerPostId: postId,
          providerConversationId: postId ? `${postId}:mentions` : `${commentId}:mention`,
          providerParticipantId: value.from?.id,
          body,
          providerCreatedAt: createdAt,
        });
      }
    }

    for (const message of entry.messaging ?? []) {
      const senderId = message.sender?.id;
      const text = message.message?.text;
      const mid = message.message?.mid;
      if (!senderId || !text || !mid) continue;

      participants.push({
        providerParticipantId: senderId,
      });
      messages.push({
        providerMessageId: mid,
        providerConversationId: `dm:${entry.id ?? senderId}`,
        providerParticipantId: senderId,
        direction: "INBOUND",
        body: text,
        providerCreatedAt: parseTimestamp(message.timestamp),
      });
    }
  }

  return {
    participants: participants.length ? participants : undefined,
    comments: comments.length ? comments : undefined,
    mentions: mentions.length ? mentions : undefined,
    messages: messages.length ? messages : undefined,
  };
}

function parseXPayload(payload: XWebhookPayload): Omit<IngestBatch, "idempotencyKey"> {
  const participants: NonNullable<IngestBatch["participants"]> = [];
  const comments: NonNullable<IngestBatch["comments"]> = [];
  const mentions: NonNullable<IngestBatch["mentions"]> = [];
  const messages: NonNullable<IngestBatch["messages"]> = [];

  for (const tweet of payload.tweet_create_events ?? []) {
    if (!tweet.id_str || !tweet.text) continue;
    const user = tweet.user;
    if (user?.id_str) {
      participants.push({
        providerParticipantId: user.id_str,
        username: user.screen_name,
        displayName: user.name ?? user.screen_name,
      });
    }

    if (tweet.in_reply_to_status_id_str) {
      comments.push({
        providerCommentId: tweet.id_str,
        providerPostId: tweet.in_reply_to_status_id_str,
        providerConversationId: `${tweet.in_reply_to_status_id_str}:replies`,
        providerParticipantId: user?.id_str,
        body: tweet.text,
        providerCreatedAt: parseTimestamp(tweet.created_at ?? Date.now()),
      });
    } else {
      mentions.push({
        providerMentionId: tweet.id_str,
        providerConversationId: `${tweet.id_str}:mention`,
        providerParticipantId: user?.id_str,
        body: tweet.text,
        providerCreatedAt: parseTimestamp(tweet.created_at ?? Date.now()),
      });
    }
  }

  for (const event of payload.direct_message_events ?? []) {
    const senderId = event.message_create?.sender_id;
    const text = event.message_create?.message_data?.text;
    if (!event.id || !senderId || !text) continue;

    participants.push({ providerParticipantId: senderId });
    messages.push({
      providerMessageId: event.id,
      providerConversationId: `dm:${senderId}`,
      providerParticipantId: senderId,
      direction: "INBOUND",
      body: text,
      providerCreatedAt: parseTimestamp(event.created_timestamp ?? Date.now()),
    });
  }

  return {
    participants: participants.length ? participants : undefined,
    comments: comments.length ? comments : undefined,
    mentions: mentions.length ? mentions : undefined,
    messages: messages.length ? messages : undefined,
  };
}

export function providerFromPathSegment(segment: string): SocialProvider | null {
  const normalized = segment.trim().toUpperCase().replace(/-/g, "_");
  const map: Record<string, SocialProvider> = {
    INSTAGRAM: "INSTAGRAM",
    FACEBOOK: "FACEBOOK",
    LINKEDIN: "LINKEDIN",
    TIKTOK: "TIKTOK",
    YOUTUBE: "YOUTUBE",
    X: "X",
    TWITTER: "X",
  };
  return map[normalized] ?? null;
}

/** Converts a provider webhook payload into an ingest batch. */
export function parseSocialInboxWebhookPayload(
  provider: SocialProvider,
  payload: string,
): Omit<IngestBatch, "idempotencyKey"> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload) as unknown;
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== "object") {
    return {};
  }

  if (provider === "X") {
    return parseXPayload(parsed as XWebhookPayload);
  }

  if (["INSTAGRAM", "FACEBOOK"].includes(provider)) {
    return parseMetaPayload(parsed as MetaWebhookPayload);
  }

  return {};
}
