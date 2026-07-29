-- Task 2.13: Unified social inbox

ALTER TYPE "AIPurpose" ADD VALUE IF NOT EXISTS 'INBOX_REPLY_SUGGEST';

CREATE TYPE "SocialConversationStatus" AS ENUM ('NEW', 'OPEN', 'PENDING', 'RESOLVED', 'SPAM', 'ARCHIVED');
CREATE TYPE "SocialMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "SocialConversationType" AS ENUM ('COMMENT', 'MENTION', 'DIRECT_MESSAGE');
CREATE TYPE "SocialInboxSyncStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL');
CREATE TYPE "SocialInboxPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "SocialInboxReplyDraftStatus" AS ENUM ('DRAFT', 'SENT', 'DISCARDED');
CREATE TYPE "SocialSafetyFlag" AS ENUM (
  'SPAM',
  'ABUSIVE_LANGUAGE',
  'PERSONAL_DATA',
  'THREAT',
  'FINANCIAL_ADVICE',
  'GRANT_ELIGIBILITY',
  'COMPLAINT_REVIEW'
);

CREATE TABLE "SocialConversation" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "socialAccountId" TEXT NOT NULL,
  "provider" "SocialProvider" NOT NULL,
  "providerConversationId" TEXT NOT NULL,
  "conversationType" "SocialConversationType" NOT NULL,
  "status" "SocialConversationStatus" NOT NULL DEFAULT 'NEW',
  "priority" "SocialInboxPriority" NOT NULL DEFAULT 'NORMAL',
  "subject" TEXT,
  "summary" TEXT,
  "relatedProviderPostId" TEXT,
  "relatedContentItemId" TEXT,
  "unreadCount" INTEGER NOT NULL DEFAULT 0,
  "safetyFlags" "SocialSafetyFlag"[] DEFAULT ARRAY[]::"SocialSafetyFlag"[],
  "requiresHumanReview" BOOLEAN NOT NULL DEFAULT false,
  "assignedToUserId" TEXT,
  "lastMessageAt" TIMESTAMP(3),
  "lastInboundAt" TIMESTAMP(3),
  "providerMetadata" JSONB,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialMessage" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "socialAccountId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "participantId" TEXT,
  "providerMessageId" TEXT NOT NULL,
  "direction" "SocialMessageDirection" NOT NULL,
  "body" TEXT NOT NULL,
  "bodyHtml" TEXT,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "isEdited" BOOLEAN NOT NULL DEFAULT false,
  "providerCreatedAt" TIMESTAMP(3) NOT NULL,
  "providerEditedAt" TIMESTAMP(3),
  "sentByUserId" TEXT,
  "providerMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialComment" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "socialAccountId" TEXT NOT NULL,
  "conversationId" TEXT,
  "participantId" TEXT,
  "providerCommentId" TEXT NOT NULL,
  "providerPostId" TEXT NOT NULL,
  "parentCommentId" TEXT,
  "body" TEXT NOT NULL,
  "isHidden" BOOLEAN NOT NULL DEFAULT false,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "providerCreatedAt" TIMESTAMP(3) NOT NULL,
  "providerEditedAt" TIMESTAMP(3),
  "providerMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialMention" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "socialAccountId" TEXT NOT NULL,
  "conversationId" TEXT,
  "participantId" TEXT,
  "providerMentionId" TEXT NOT NULL,
  "providerPostId" TEXT,
  "body" TEXT NOT NULL,
  "providerCreatedAt" TIMESTAMP(3) NOT NULL,
  "providerMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialMention_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialParticipant" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "socialAccountId" TEXT NOT NULL,
  "provider" "SocialProvider" NOT NULL,
  "providerParticipantId" TEXT NOT NULL,
  "displayName" TEXT,
  "username" TEXT,
  "profileUrl" TEXT,
  "avatarUrl" TEXT,
  "providerMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialInboxAssignment" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "assignedToUserId" TEXT NOT NULL,
  "assignedByUserId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialInboxAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialInboxTag" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "tag" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialInboxTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialInboxStatusHistory" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "fromStatus" "SocialConversationStatus",
  "toStatus" "SocialConversationStatus" NOT NULL,
  "changedByUserId" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialInboxStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialInboxReplyDraft" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "SocialInboxReplyDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
  "aiRequestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialInboxReplyDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialInboxSync" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "socialAccountId" TEXT NOT NULL,
  "provider" "SocialProvider" NOT NULL,
  "status" "SocialInboxSyncStatus" NOT NULL DEFAULT 'QUEUED',
  "syncType" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "cursor" JSONB,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "scheduledFor" TIMESTAMP(3),
  "nextRetryAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialInboxSync_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialInboxWebhookEvent" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "socialAccountId" TEXT NOT NULL,
  "provider" "SocialProvider" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadDigest" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialInboxWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialInboxWebhookSubscription" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "socialAccountId" TEXT NOT NULL,
  "provider" "SocialProvider" NOT NULL,
  "verifyTokenDigest" TEXT NOT NULL,
  "secretDigest" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "subscribedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialInboxWebhookSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialConversation_socialAccountId_providerConversationId_key"
  ON "SocialConversation"("socialAccountId", "providerConversationId");
CREATE INDEX "SocialConversation_organisationId_brandId_status_idx"
  ON "SocialConversation"("organisationId", "brandId", "status");
CREATE INDEX "SocialConversation_socialAccountId_lastMessageAt_idx"
  ON "SocialConversation"("socialAccountId", "lastMessageAt");
CREATE INDEX "SocialConversation_assignedToUserId_idx" ON "SocialConversation"("assignedToUserId");
CREATE INDEX "SocialConversation_conversationType_idx" ON "SocialConversation"("conversationType");
CREATE INDEX "SocialConversation_unreadCount_idx" ON "SocialConversation"("unreadCount");

CREATE UNIQUE INDEX "SocialMessage_conversationId_providerMessageId_key"
  ON "SocialMessage"("conversationId", "providerMessageId");
CREATE INDEX "SocialMessage_organisationId_brandId_idx" ON "SocialMessage"("organisationId", "brandId");
CREATE INDEX "SocialMessage_conversationId_providerCreatedAt_idx"
  ON "SocialMessage"("conversationId", "providerCreatedAt");
CREATE INDEX "SocialMessage_direction_idx" ON "SocialMessage"("direction");

CREATE UNIQUE INDEX "SocialComment_socialAccountId_providerCommentId_key"
  ON "SocialComment"("socialAccountId", "providerCommentId");
CREATE INDEX "SocialComment_organisationId_brandId_idx" ON "SocialComment"("organisationId", "brandId");
CREATE INDEX "SocialComment_providerPostId_idx" ON "SocialComment"("providerPostId");
CREATE INDEX "SocialComment_conversationId_idx" ON "SocialComment"("conversationId");

CREATE UNIQUE INDEX "SocialMention_socialAccountId_providerMentionId_key"
  ON "SocialMention"("socialAccountId", "providerMentionId");
CREATE INDEX "SocialMention_organisationId_brandId_idx" ON "SocialMention"("organisationId", "brandId");
CREATE INDEX "SocialMention_conversationId_idx" ON "SocialMention"("conversationId");

CREATE UNIQUE INDEX "SocialParticipant_socialAccountId_providerParticipantId_key"
  ON "SocialParticipant"("socialAccountId", "providerParticipantId");
CREATE INDEX "SocialParticipant_organisationId_brandId_idx" ON "SocialParticipant"("organisationId", "brandId");

CREATE INDEX "SocialInboxAssignment_conversationId_createdAt_idx"
  ON "SocialInboxAssignment"("conversationId", "createdAt");
CREATE INDEX "SocialInboxAssignment_assignedToUserId_idx" ON "SocialInboxAssignment"("assignedToUserId");

CREATE UNIQUE INDEX "SocialInboxTag_conversationId_tag_key" ON "SocialInboxTag"("conversationId", "tag");
CREATE INDEX "SocialInboxTag_organisationId_brandId_tag_idx"
  ON "SocialInboxTag"("organisationId", "brandId", "tag");

CREATE INDEX "SocialInboxStatusHistory_conversationId_createdAt_idx"
  ON "SocialInboxStatusHistory"("conversationId", "createdAt");

CREATE INDEX "SocialInboxReplyDraft_conversationId_status_idx"
  ON "SocialInboxReplyDraft"("conversationId", "status");
CREATE INDEX "SocialInboxReplyDraft_authorUserId_idx" ON "SocialInboxReplyDraft"("authorUserId");

CREATE UNIQUE INDEX "SocialInboxSync_idempotencyKey_key" ON "SocialInboxSync"("idempotencyKey");
CREATE INDEX "SocialInboxSync_organisationId_brandId_idx" ON "SocialInboxSync"("organisationId", "brandId");
CREATE INDEX "SocialInboxSync_socialAccountId_status_idx" ON "SocialInboxSync"("socialAccountId", "status");
CREATE INDEX "SocialInboxSync_scheduledFor_idx" ON "SocialInboxSync"("scheduledFor");

CREATE UNIQUE INDEX "SocialInboxWebhookEvent_socialAccountId_idempotencyKey_key"
  ON "SocialInboxWebhookEvent"("socialAccountId", "idempotencyKey");
CREATE INDEX "SocialInboxWebhookEvent_organisationId_brandId_idx"
  ON "SocialInboxWebhookEvent"("organisationId", "brandId");
CREATE INDEX "SocialInboxWebhookEvent_status_idx" ON "SocialInboxWebhookEvent"("status");

CREATE UNIQUE INDEX "SocialInboxWebhookSubscription_socialAccountId_key"
  ON "SocialInboxWebhookSubscription"("socialAccountId");
CREATE INDEX "SocialInboxWebhookSubscription_organisationId_brandId_idx"
  ON "SocialInboxWebhookSubscription"("organisationId", "brandId");

ALTER TABLE "SocialConversation" ADD CONSTRAINT "SocialConversation_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialConversation" ADD CONSTRAINT "SocialConversation_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialConversation" ADD CONSTRAINT "SocialConversation_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialConversation" ADD CONSTRAINT "SocialConversation_socialAccountId_fkey"
  FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialConversation" ADD CONSTRAINT "SocialConversation_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SocialMessage" ADD CONSTRAINT "SocialMessage_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialMessage" ADD CONSTRAINT "SocialMessage_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialMessage" ADD CONSTRAINT "SocialMessage_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialMessage" ADD CONSTRAINT "SocialMessage_socialAccountId_fkey"
  FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialMessage" ADD CONSTRAINT "SocialMessage_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "SocialConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialMessage" ADD CONSTRAINT "SocialMessage_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "SocialParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialMessage" ADD CONSTRAINT "SocialMessage_sentByUserId_fkey"
  FOREIGN KEY ("sentByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_socialAccountId_fkey"
  FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "SocialConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "SocialParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SocialMention" ADD CONSTRAINT "SocialMention_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialMention" ADD CONSTRAINT "SocialMention_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialMention" ADD CONSTRAINT "SocialMention_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialMention" ADD CONSTRAINT "SocialMention_socialAccountId_fkey"
  FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialMention" ADD CONSTRAINT "SocialMention_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "SocialConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialMention" ADD CONSTRAINT "SocialMention_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "SocialParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SocialParticipant" ADD CONSTRAINT "SocialParticipant_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialParticipant" ADD CONSTRAINT "SocialParticipant_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialParticipant" ADD CONSTRAINT "SocialParticipant_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialParticipant" ADD CONSTRAINT "SocialParticipant_socialAccountId_fkey"
  FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialInboxAssignment" ADD CONSTRAINT "SocialInboxAssignment_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialInboxAssignment" ADD CONSTRAINT "SocialInboxAssignment_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialInboxAssignment" ADD CONSTRAINT "SocialInboxAssignment_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialInboxAssignment" ADD CONSTRAINT "SocialInboxAssignment_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "SocialConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialInboxAssignment" ADD CONSTRAINT "SocialInboxAssignment_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialInboxAssignment" ADD CONSTRAINT "SocialInboxAssignment_assignedByUserId_fkey"
  FOREIGN KEY ("assignedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SocialInboxTag" ADD CONSTRAINT "SocialInboxTag_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialInboxTag" ADD CONSTRAINT "SocialInboxTag_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialInboxTag" ADD CONSTRAINT "SocialInboxTag_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialInboxTag" ADD CONSTRAINT "SocialInboxTag_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "SocialConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialInboxStatusHistory" ADD CONSTRAINT "SocialInboxStatusHistory_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialInboxStatusHistory" ADD CONSTRAINT "SocialInboxStatusHistory_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialInboxStatusHistory" ADD CONSTRAINT "SocialInboxStatusHistory_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialInboxStatusHistory" ADD CONSTRAINT "SocialInboxStatusHistory_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "SocialConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialInboxStatusHistory" ADD CONSTRAINT "SocialInboxStatusHistory_changedByUserId_fkey"
  FOREIGN KEY ("changedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SocialInboxReplyDraft" ADD CONSTRAINT "SocialInboxReplyDraft_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialInboxReplyDraft" ADD CONSTRAINT "SocialInboxReplyDraft_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialInboxReplyDraft" ADD CONSTRAINT "SocialInboxReplyDraft_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialInboxReplyDraft" ADD CONSTRAINT "SocialInboxReplyDraft_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "SocialConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialInboxReplyDraft" ADD CONSTRAINT "SocialInboxReplyDraft_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
