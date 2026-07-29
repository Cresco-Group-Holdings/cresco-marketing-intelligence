import type { SocialMessageDirection, SocialProvider } from "@prisma/client";

export type InboxInteractionKind = "COMMENT" | "MENTION" | "DIRECT_MESSAGE";

export type InboxParticipantSummary = {
  providerParticipantId: string;
  displayName?: string;
  username?: string;
  profileUrl?: string;
  avatarUrl?: string;
};

export type InboxInteractionBase = {
  providerId: string;
  providerPostId?: string;
  providerConversationId?: string;
  body: string;
  author: InboxParticipantSummary;
  providerCreatedAt: Date;
  providerEditedAt?: Date;
  isDeleted: boolean;
  isEdited: boolean;
  isHidden?: boolean;
  providerMetadata?: Record<string, unknown>;
};

export type InboxCommentInteraction = InboxInteractionBase & {
  kind: "COMMENT";
  providerCommentId: string;
  parentCommentId?: string;
};

export type InboxMentionInteraction = InboxInteractionBase & {
  kind: "MENTION";
  providerMentionId: string;
};

export type InboxDirectMessageInteraction = InboxInteractionBase & {
  kind: "DIRECT_MESSAGE";
  providerMessageId: string;
  direction: SocialMessageDirection;
};

export type InboxInteraction =
  | InboxCommentInteraction
  | InboxMentionInteraction
  | InboxDirectMessageInteraction;

export type InboxFetchInput = {
  accessToken: string;
  providerAccountId: string;
  cursor?: string;
  since?: Date;
};

export type InboxReplyInput = {
  accessToken: string;
  providerAccountId: string;
  providerConversationId: string;
  providerTargetId: string;
  body: string;
};

export type InboxHideCommentInput = {
  accessToken: string;
  providerAccountId: string;
  providerCommentId: string;
};

export type InboxFetchResult<T extends InboxInteraction> = {
  items: T[];
  cursor?: string;
  hasMore: boolean;
  raw?: unknown;
};

export type InboxReplyResult = {
  providerMessageId: string;
  providerCreatedAt: Date;
  raw?: unknown;
};

export class SocialInboxProviderError extends Error {
  constructor(
    readonly code:
      | "RATE_LIMITED"
      | "TOKEN_EXPIRED"
      | "PERMISSION_MISSING"
      | "NOT_FOUND"
      | "UNAVAILABLE"
      | "TRANSIENT"
      | "PROVIDER_ERROR",
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "SocialInboxProviderError";
  }
}

export interface SocialInboxAdapter {
  readonly provider: SocialProvider;
  fetchComments(input: InboxFetchInput): Promise<InboxFetchResult<InboxCommentInteraction>>;
  fetchMentions(input: InboxFetchInput): Promise<InboxFetchResult<InboxMentionInteraction>>;
  fetchDirectMessages(
    input: InboxFetchInput,
  ): Promise<InboxFetchResult<InboxDirectMessageInteraction>>;
  sendReply(input: InboxReplyInput): Promise<InboxReplyResult>;
  hideComment(input: InboxHideCommentInput): Promise<void>;
}

function mockAuthor(provider: SocialProvider, index: number): InboxParticipantSummary {
  const slug = provider.toLowerCase();
  return {
    providerParticipantId: `${slug}-user-${index}`,
    displayName: `${provider} User ${index}`,
    username: `${slug}_user_${index}`,
    profileUrl: `https://example.com/${slug}/user/${index}`,
  };
}

function mockTimestamp(offsetMinutes: number): Date {
  return new Date(Date.now() - offsetMinutes * 60_000);
}

class MockSocialInboxAdapter implements SocialInboxAdapter {
  readonly provider: SocialProvider;

  constructor(provider: SocialProvider) {
    this.provider = provider;
  }

  async fetchComments(
    input: InboxFetchInput,
  ): Promise<InboxFetchResult<InboxCommentInteraction>> {
    if (!input.accessToken) {
      throw new SocialInboxProviderError("TOKEN_EXPIRED", "Inbox credentials expired.", true);
    }

    const slug = this.provider.toLowerCase();
    const items: InboxCommentInteraction[] = [
      {
        kind: "COMMENT",
        providerId: `${slug}-comment-1`,
        providerCommentId: `${slug}-comment-1`,
        providerPostId: `${slug}-post-1`,
        providerConversationId: `${slug}-conv-comment-1`,
        body: `Mock ${this.provider} comment awaiting a reply.`,
        author: mockAuthor(this.provider, 1),
        providerCreatedAt: mockTimestamp(45),
        isDeleted: false,
        isEdited: false,
        providerMetadata: { source: "mock" },
      },
      {
        kind: "COMMENT",
        providerId: `${slug}-comment-2`,
        providerCommentId: `${slug}-comment-2`,
        providerPostId: `${slug}-post-1`,
        parentCommentId: `${slug}-comment-1`,
        providerConversationId: `${slug}-conv-comment-1`,
        body: "Thanks — can you share more details?",
        author: mockAuthor(this.provider, 2),
        providerCreatedAt: mockTimestamp(20),
        providerEditedAt: mockTimestamp(15),
        isDeleted: false,
        isEdited: true,
        providerMetadata: { source: "mock" },
      },
    ];

    return { items, hasMore: false, raw: { provider: this.provider, type: "comments" } };
  }

  async fetchMentions(
    input: InboxFetchInput,
  ): Promise<InboxFetchResult<InboxMentionInteraction>> {
    if (!input.accessToken) {
      throw new SocialInboxProviderError("TOKEN_EXPIRED", "Inbox credentials expired.", true);
    }

    const slug = this.provider.toLowerCase();
    const supportsMentions = !["TIKTOK"].includes(this.provider);
    const items: InboxMentionInteraction[] = supportsMentions
      ? [
          {
            kind: "MENTION",
            providerId: `${slug}-mention-1`,
            providerMentionId: `${slug}-mention-1`,
            providerPostId: `${slug}-post-2`,
            providerConversationId: `${slug}-conv-mention-1`,
            body: `@brand Great update on the launch!`,
            author: mockAuthor(this.provider, 3),
            providerCreatedAt: mockTimestamp(30),
            isDeleted: false,
            isEdited: false,
            providerMetadata: { source: "mock" },
          },
        ]
      : [];

    return { items, hasMore: false, raw: { provider: this.provider, type: "mentions" } };
  }

  async fetchDirectMessages(
    input: InboxFetchInput,
  ): Promise<InboxFetchResult<InboxDirectMessageInteraction>> {
    if (!input.accessToken) {
      throw new SocialInboxProviderError("TOKEN_EXPIRED", "Inbox credentials expired.", true);
    }

    const slug = this.provider.toLowerCase();
    const supportsDm = ["FACEBOOK", "X"].includes(this.provider);
    const items: InboxDirectMessageInteraction[] = supportsDm
      ? [
          {
            kind: "DIRECT_MESSAGE",
            providerId: `${slug}-dm-1`,
            providerMessageId: `${slug}-dm-1`,
            providerConversationId: `${slug}-conv-dm-1`,
            body: "Hi, do you offer support on weekends?",
            author: mockAuthor(this.provider, 4),
            direction: "INBOUND",
            providerCreatedAt: mockTimestamp(10),
            isDeleted: false,
            isEdited: false,
            providerMetadata: { source: "mock" },
          },
        ]
      : [];

    return { items, hasMore: false, raw: { provider: this.provider, type: "direct_messages" } };
  }

  async sendReply(input: InboxReplyInput): Promise<InboxReplyResult> {
    if (!input.accessToken) {
      throw new SocialInboxProviderError("TOKEN_EXPIRED", "Inbox credentials expired.", true);
    }

    const slug = this.provider.toLowerCase();
    return {
      providerMessageId: `${slug}-reply-${Date.now()}`,
      providerCreatedAt: new Date(),
      raw: {
        provider: this.provider,
        targetId: input.providerTargetId,
        conversationId: input.providerConversationId,
      },
    };
  }

  async hideComment(input: InboxHideCommentInput): Promise<void> {
    if (!input.accessToken) {
      throw new SocialInboxProviderError("TOKEN_EXPIRED", "Inbox credentials expired.", true);
    }
  }
}

const adapters: Record<SocialProvider, SocialInboxAdapter> = {
  INSTAGRAM: new MockSocialInboxAdapter("INSTAGRAM"),
  FACEBOOK: new MockSocialInboxAdapter("FACEBOOK"),
  LINKEDIN: new MockSocialInboxAdapter("LINKEDIN"),
  TIKTOK: new MockSocialInboxAdapter("TIKTOK"),
  YOUTUBE: new MockSocialInboxAdapter("YOUTUBE"),
  X: new MockSocialInboxAdapter("X"),
};

export function getSocialInboxAdapter(provider: SocialProvider): SocialInboxAdapter {
  return adapters[provider];
}
