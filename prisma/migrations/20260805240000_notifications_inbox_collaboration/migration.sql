-- Stage 15: Notifications, Inbox and Collaboration

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

CREATE TYPE "InboxSection" AS ENUM (
  'ALL', 'ASSIGNED', 'APPROVALS', 'MENTIONS', 'CAMPAIGNS',
  'PUBLISHING', 'INTEGRATIONS', 'CRM', 'AI', 'SYSTEM'
);

CREATE TYPE "InboxItemStatus" AS ENUM ('UNREAD', 'READ', 'DISMISSED', 'ARCHIVED');

CREATE TYPE "CommentThreadStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TYPE "AnnouncementPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TYPE "DigestFrequency" AS ENUM ('DAILY', 'WEEKLY');

CREATE TABLE "InboxItem" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "section" "InboxSection" NOT NULL,
  "category" "NotificationCategory" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
  "sourceEntityType" TEXT,
  "sourceEntityId" TEXT,
  "actionUrl" TEXT,
  "notificationId" TEXT,
  "assignedToUserId" TEXT,
  "status" "InboxItemStatus" NOT NULL DEFAULT 'UNREAD',
  "idempotencyKey" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InboxItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommentThread" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT,
  "brandId" TEXT,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "status" "CommentThreadStatus" NOT NULL DEFAULT 'OPEN',
  "resolvedByUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommentThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CollaborationComment" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "sanitizedBody" TEXT NOT NULL,
  "editHistory" JSONB,
  "attachmentRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CollaborationComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserMention" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "mentionedUserId" TEXT NOT NULL,
  "mentionedByUserId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserMention_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Announcement" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "sanitizedBody" TEXT NOT NULL,
  "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
  "actionUrl" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "dismissible" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnnouncementDismissal" (
  "id" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnnouncementDismissal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DigestSubscription" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "frequency" "DigestFrequency" NOT NULL DEFAULT 'DAILY',
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "includeOverdue" BOOLEAN NOT NULL DEFAULT true,
  "includeApprovals" BOOLEAN NOT NULL DEFAULT true,
  "includeConnections" BOOLEAN NOT NULL DEFAULT true,
  "includeCampaignAlerts" BOOLEAN NOT NULL DEFAULT true,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DigestSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InboxItem_notificationId_key" ON "InboxItem"("notificationId");
CREATE UNIQUE INDEX "InboxItem_userId_idempotencyKey_key" ON "InboxItem"("userId", "idempotencyKey");
CREATE INDEX "InboxItem_organisationId_userId_status_createdAt_idx" ON "InboxItem"("organisationId", "userId", "status", "createdAt");
CREATE INDEX "InboxItem_organisationId_userId_section_status_idx" ON "InboxItem"("organisationId", "userId", "section", "status");
CREATE INDEX "InboxItem_assignedToUserId_status_idx" ON "InboxItem"("assignedToUserId", "status");

CREATE UNIQUE INDEX "CommentThread_organisationId_resourceType_resourceId_key" ON "CommentThread"("organisationId", "resourceType", "resourceId");
CREATE INDEX "CommentThread_organisationId_brandId_idx" ON "CommentThread"("organisationId", "brandId");
CREATE INDEX "CommentThread_resourceType_resourceId_idx" ON "CommentThread"("resourceType", "resourceId");

CREATE INDEX "CollaborationComment_threadId_createdAt_idx" ON "CollaborationComment"("threadId", "createdAt");
CREATE INDEX "CollaborationComment_organisationId_authorUserId_idx" ON "CollaborationComment"("organisationId", "authorUserId");

CREATE UNIQUE INDEX "UserMention_commentId_mentionedUserId_key" ON "UserMention"("commentId", "mentionedUserId");
CREATE INDEX "UserMention_organisationId_mentionedUserId_readAt_idx" ON "UserMention"("organisationId", "mentionedUserId", "readAt");

CREATE INDEX "Announcement_organisationId_startsAt_endsAt_idx" ON "Announcement"("organisationId", "startsAt", "endsAt");
CREATE UNIQUE INDEX "AnnouncementDismissal_announcementId_userId_key" ON "AnnouncementDismissal"("announcementId", "userId");

CREATE UNIQUE INDEX "DigestSubscription_organisationId_userId_frequency_key" ON "DigestSubscription"("organisationId", "userId", "frequency");
CREATE INDEX "DigestSubscription_organisationId_userId_idx" ON "DigestSubscription"("organisationId", "userId");

ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommentThread" ADD CONSTRAINT "CommentThread_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommentThread" ADD CONSTRAINT "CommentThread_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommentThread" ADD CONSTRAINT "CommentThread_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommentThread" ADD CONSTRAINT "CommentThread_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CollaborationComment" ADD CONSTRAINT "CollaborationComment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollaborationComment" ADD CONSTRAINT "CollaborationComment_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CommentThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollaborationComment" ADD CONSTRAINT "CollaborationComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserMention" ADD CONSTRAINT "UserMention_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserMention" ADD CONSTRAINT "UserMention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CollaborationComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserMention" ADD CONSTRAINT "UserMention_mentionedUserId_fkey" FOREIGN KEY ("mentionedUserId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserMention" ADD CONSTRAINT "UserMention_mentionedByUserId_fkey" FOREIGN KEY ("mentionedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnnouncementDismissal" ADD CONSTRAINT "AnnouncementDismissal_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnouncementDismissal" ADD CONSTRAINT "AnnouncementDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DigestSubscription" ADD CONSTRAINT "DigestSubscription_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigestSubscription" ADD CONSTRAINT "DigestSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
