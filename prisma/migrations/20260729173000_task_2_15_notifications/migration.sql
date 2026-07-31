-- Task 2.15 — Notifications and operational failure recovery

CREATE TYPE "NotificationCategory" AS ENUM (
  'CONTENT',
  'APPROVAL',
  'SCHEDULING',
  'PUBLISHING',
  'CONNECTION',
  'ANALYTICS',
  'INBOX',
  'LEAD',
  'SECURITY',
  'SYSTEM'
);

CREATE TYPE "NotificationChannel" AS ENUM (
  'IN_APP',
  'EMAIL',
  'SLACK',
  'TEAMS',
  'PUSH',
  'DIGEST_DAILY',
  'DIGEST_WEEKLY'
);

CREATE TYPE "NotificationDeliveryStatus" AS ENUM (
  'PENDING',
  'SENT',
  'FAILED',
  'SKIPPED',
  'SUPPRESSED'
);

CREATE TYPE "NotificationDeliveryMode" AS ENUM (
  'IMMEDIATE',
  'DIGEST_DAILY',
  'DIGEST_WEEKLY'
);

CREATE TYPE "NotificationPriority" AS ENUM (
  'LOW',
  'NORMAL',
  'HIGH',
  'CRITICAL'
);

CREATE TYPE "OperationalAlertStatus" AS ENUM (
  'OPEN',
  'ACKNOWLEDGED',
  'RETRYING',
  'RESOLVED',
  'DEAD_LETTER',
  'CANCELLED'
);

CREATE TYPE "OperationalAlertType" AS ENUM (
  'PUBLISHING_FAILURE',
  'PUBLISHING_PARTIAL',
  'CONNECTOR_SYNC_FAILURE',
  'ANALYTICS_SYNC_FAILURE',
  'TOKEN_REAUTH_REQUIRED',
  'RENDER_FAILURE',
  'INBOX_ATTENTION',
  'LEAD_ARRIVED',
  'ASSET_LICENCE_EXPIRY',
  'SYSTEM'
);

CREATE TYPE "RecoveryActionType" AS ENUM (
  'RETRY',
  'RECONNECT',
  'CANCEL',
  'RESOLVE',
  'MANUAL_CONFIRM'
);

CREATE TYPE "RecoveryActionStatus" AS ENUM (
  'PENDING',
  'COMPLETED',
  'FAILED'
);

ALTER TABLE "PublishingJob"
  ADD COLUMN IF NOT EXISTS "nextRetryAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deadLetterAt" TIMESTAMP(3);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT,
  "brandId" TEXT,
  "userId" TEXT NOT NULL,
  "category" "NotificationCategory" NOT NULL,
  "eventType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "safeBody" TEXT NOT NULL,
  "resourceType" TEXT,
  "resourceId" TEXT,
  "actionUrl" TEXT,
  "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
  "idempotencyKey" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "brandId" TEXT,
  "category" "NotificationCategory" NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "deliveryMode" "NotificationDeliveryMode" NOT NULL DEFAULT 'IMMEDIATE',
  "quietHoursStart" TEXT,
  "quietHoursEnd" TEXT,
  "timezone" TEXT DEFAULT 'UTC',
  "isCriticalLocked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "digestId" TEXT,
  "externalId" TEXT,
  "errorMessage" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDigest" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "itemCount" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationDigest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationalAlert" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT,
  "brandId" TEXT,
  "alertType" "OperationalAlertType" NOT NULL,
  "category" "NotificationCategory" NOT NULL,
  "status" "OperationalAlertStatus" NOT NULL DEFAULT 'OPEN',
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "provider" TEXT,
  "title" TEXT NOT NULL,
  "safeErrorMessage" TEXT NOT NULL,
  "recommendedAction" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "lastAttemptAt" TIMESTAMP(3),
  "nextRetryAt" TIMESTAMP(3),
  "idempotencyKey" TEXT NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OperationalAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecoveryAction" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "operationalAlertId" TEXT,
  "actorUserId" TEXT NOT NULL,
  "actionType" "RecoveryActionType" NOT NULL,
  "status" "RecoveryActionStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "resourceType" TEXT,
  "resourceId" TEXT,
  "result" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "RecoveryAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notification_userId_idempotencyKey_key" ON "Notification"("userId", "idempotencyKey");
CREATE INDEX "Notification_organisationId_userId_createdAt_idx" ON "Notification"("organisationId", "userId", "createdAt");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "Notification_category_idx" ON "Notification"("category");

CREATE UNIQUE INDEX "NotificationPreference_userId_organisationId_brandId_category_channel_key" ON "NotificationPreference"("userId", "organisationId", "brandId", "category", "channel");
CREATE INDEX "NotificationPreference_organisationId_userId_idx" ON "NotificationPreference"("organisationId", "userId");

CREATE INDEX "NotificationDelivery_notificationId_idx" ON "NotificationDelivery"("notificationId");
CREATE INDEX "NotificationDelivery_status_idx" ON "NotificationDelivery"("status");

CREATE INDEX "NotificationDigest_organisationId_userId_createdAt_idx" ON "NotificationDigest"("organisationId", "userId", "createdAt");

CREATE UNIQUE INDEX "OperationalAlert_organisationId_idempotencyKey_key" ON "OperationalAlert"("organisationId", "idempotencyKey");
CREATE INDEX "OperationalAlert_organisationId_brandId_status_idx" ON "OperationalAlert"("organisationId", "brandId", "status");
CREATE INDEX "OperationalAlert_alertType_status_idx" ON "OperationalAlert"("alertType", "status");
CREATE INDEX "OperationalAlert_resourceType_resourceId_idx" ON "OperationalAlert"("resourceType", "resourceId");

CREATE UNIQUE INDEX "RecoveryAction_organisationId_idempotencyKey_key" ON "RecoveryAction"("organisationId", "idempotencyKey");
CREATE INDEX "RecoveryAction_operationalAlertId_idx" ON "RecoveryAction"("operationalAlertId");
CREATE INDEX "RecoveryAction_organisationId_status_idx" ON "RecoveryAction"("organisationId", "status");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_digestId_fkey" FOREIGN KEY ("digestId") REFERENCES "NotificationDigest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationDigest" ADD CONSTRAINT "NotificationDigest_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDigest" ADD CONSTRAINT "NotificationDigest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OperationalAlert" ADD CONSTRAINT "OperationalAlert_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperationalAlert" ADD CONSTRAINT "OperationalAlert_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperationalAlert" ADD CONSTRAINT "OperationalAlert_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperationalAlert" ADD CONSTRAINT "OperationalAlert_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecoveryAction" ADD CONSTRAINT "RecoveryAction_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecoveryAction" ADD CONSTRAINT "RecoveryAction_operationalAlertId_fkey" FOREIGN KEY ("operationalAlertId") REFERENCES "OperationalAlert"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecoveryAction" ADD CONSTRAINT "RecoveryAction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
