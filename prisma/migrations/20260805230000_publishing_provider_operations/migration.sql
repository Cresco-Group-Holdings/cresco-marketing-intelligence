-- Stage 14: Publishing and Provider Operations

CREATE TYPE "PublicationStatus" AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'QUEUED',
  'SCHEDULED',
  'PUBLISHING',
  'PUBLISHED',
  'PARTIALLY_PUBLISHED',
  'FAILED',
  'CANCELLED',
  'REMOVED'
);

CREATE TYPE "PublicationOperationType" AS ENUM (
  'SOCIAL_PUBLISH_POST',
  'SOCIAL_SCHEDULE_POST',
  'SOCIAL_PUBLISH_IMAGE',
  'SOCIAL_PUBLISH_VIDEO',
  'SOCIAL_PUBLISH_MULTI_ASSET',
  'SOCIAL_CANCEL_SCHEDULED',
  'SOCIAL_GET_STATUS',
  'AD_CREATE_DRAFT_CAMPAIGN',
  'AD_CREATE_AD_GROUP',
  'AD_CREATE_AD_DRAFT',
  'AD_UPLOAD_CREATIVE',
  'AD_PAUSE',
  'AD_RESUME',
  'AD_UPDATE_BUDGET',
  'EMAIL_CREATE_DRAFT',
  'EMAIL_CREATE_CONTENT',
  'EMAIL_SELECT_AUDIENCE',
  'EMAIL_SCHEDULE',
  'EMAIL_CANCEL',
  'EMAIL_GET_STATUS',
  'CALENDAR_CREATE_EVENT',
  'CALENDAR_UPDATE_EVENT'
);

CREATE TYPE "PublicationAttemptStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'UNKNOWN',
  'CANCELLED'
);

CREATE TABLE "Publication" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "campaignId" TEXT,
  "contentItemId" TEXT NOT NULL,
  "contentVariantId" TEXT,
  "connectionId" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "externalAccountId" TEXT NOT NULL,
  "destinationType" TEXT NOT NULL,
  "destinationId" TEXT NOT NULL,
  "operationType" "PublicationOperationType" NOT NULL,
  "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduledFor" TIMESTAMP(3),
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "idempotencyKey" TEXT NOT NULL,
  "externalPublicationId" TEXT,
  "dryRun" BOOLEAN NOT NULL DEFAULT false,
  "validationResult" JSONB,
  "providerPayload" JSONB,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "requestedByUserId" TEXT NOT NULL,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "providerPermalink" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "cancelledAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),

  CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicationAttempt" (
  "id" TEXT NOT NULL,
  "publicationId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "status" "PublicationAttemptStatus" NOT NULL DEFAULT 'PENDING',
  "dryRun" BOOLEAN NOT NULL DEFAULT false,
  "providerResponse" JSONB,
  "errorCode" TEXT,
  "errorMessageSafe" TEXT,
  "requestId" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PublicationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicationBudgetChange" (
  "id" TEXT NOT NULL,
  "publicationId" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "externalCampaignId" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "currentBudget" DECIMAL(18,4) NOT NULL,
  "proposedBudget" DECIMAL(18,4) NOT NULL,
  "percentageChange" DECIMAL(8,4) NOT NULL,
  "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PublicationBudgetChange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Publication_organisationId_brandId_idempotencyKey_key" ON "Publication"("organisationId", "brandId", "idempotencyKey");
CREATE INDEX "Publication_organisationId_brandId_status_updatedAt_idx" ON "Publication"("organisationId", "brandId", "status", "updatedAt");
CREATE INDEX "Publication_connectionId_status_idx" ON "Publication"("connectionId", "status");
CREATE INDEX "Publication_contentItemId_idx" ON "Publication"("contentItemId");
CREATE INDEX "Publication_scheduledFor_idx" ON "Publication"("scheduledFor");
CREATE INDEX "Publication_status_scheduledFor_idx" ON "Publication"("status", "scheduledFor");

CREATE UNIQUE INDEX "PublicationAttempt_publicationId_attemptNumber_key" ON "PublicationAttempt"("publicationId", "attemptNumber");
CREATE INDEX "PublicationAttempt_publicationId_createdAt_idx" ON "PublicationAttempt"("publicationId", "createdAt");

CREATE INDEX "PublicationBudgetChange_publicationId_idx" ON "PublicationBudgetChange"("publicationId");
CREATE INDEX "PublicationBudgetChange_organisationId_brandId_idx" ON "PublicationBudgetChange"("organisationId", "brandId");

ALTER TABLE "Publication" ADD CONSTRAINT "Publication_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProviderConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PublicationAttempt" ADD CONSTRAINT "PublicationAttempt_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublicationBudgetChange" ADD CONSTRAINT "PublicationBudgetChange_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationBudgetChange" ADD CONSTRAINT "PublicationBudgetChange_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
