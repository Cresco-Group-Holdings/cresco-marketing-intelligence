import type {
  SocialConversationType,
  SocialMessageDirection,
  SocialProvider,
} from "@prisma/client";

export type IngestParticipant = {
  providerParticipantId: string;
  displayName?: string;
  username?: string;
  profileUrl?: string;
  avatarUrl?: string;
  providerMetadata?: Record<string, unknown>;
};

export type IngestConversation = {
  providerConversationId: string;
  conversationType: SocialConversationType;
  subject?: string;
  summary?: string;
  relatedProviderPostId?: string;
  relatedContentItemId?: string;
  providerMetadata?: Record<string, unknown>;
};

export type IngestMessage = {
  providerMessageId: string;
  providerParticipantId?: string;
  direction: SocialMessageDirection;
  body: string;
  bodyHtml?: string;
  isDeleted?: boolean;
  isEdited?: boolean;
  providerCreatedAt: Date;
  providerEditedAt?: Date;
  providerMetadata?: Record<string, unknown>;
};

export type IngestComment = {
  providerCommentId: string;
  providerPostId: string;
  providerConversationId?: string;
  providerParticipantId?: string;
  parentCommentId?: string;
  body: string;
  isHidden?: boolean;
  isDeleted?: boolean;
  providerCreatedAt: Date;
  providerEditedAt?: Date;
  providerMetadata?: Record<string, unknown>;
};

export type IngestMention = {
  providerMentionId: string;
  providerPostId?: string;
  providerConversationId?: string;
  providerParticipantId?: string;
  body: string;
  providerCreatedAt: Date;
  providerMetadata?: Record<string, unknown>;
};

export type IngestBatch = {
  idempotencyKey: string;
  participants?: IngestParticipant[];
  conversations?: IngestConversation[];
  messages?: IngestMessage[];
  comments?: IngestComment[];
  mentions?: IngestMention[];
};

export type InboxAccountScope = {
  organisationId: string;
  projectId: string;
  brandId: string;
  socialAccountId: string;
  provider: SocialProvider;
};

export type InboxFetchResult = {
  batch: Omit<IngestBatch, "idempotencyKey">;
  cursor?: string;
  hasMore: boolean;
};
