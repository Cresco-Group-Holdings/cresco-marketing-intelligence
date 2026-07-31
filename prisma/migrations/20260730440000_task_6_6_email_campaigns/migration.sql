-- Task 6.6: Email Campaigns and Newsletter Management

-- CreateEnum
CREATE TYPE "EmailCampaignStatus" AS ENUM ('DRAFT', 'BUILDING', 'READY_FOR_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SCHEDULED', 'SENDING', 'SENT', 'PARTIALLY_SENT', 'CANCELLED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EmailCampaignType" AS ENUM ('NEWSLETTER', 'PRODUCT_UPDATE', 'EDUCATIONAL', 'EVENT_INVITATION', 'ANNOUNCEMENT', 'LEAD_NURTURE_BROADCAST', 'CUSTOMER_UPDATE', 'RE_ENGAGEMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CrmAudienceSegmentStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EmailCampaignApprovalType" AS ENUM ('AUDIENCE', 'CONTENT', 'COMPLIANCE', 'SCHEDULE', 'FINAL_SEND');

-- CreateEnum
CREATE TYPE "EmailCampaignApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "EmailCampaignReadinessCheckType" AS ENUM ('SENDING_DOMAIN', 'VERIFIED_SENDER', 'TEMPLATE_APPROVAL', 'AUDIENCE_ELIGIBILITY', 'CONSENT', 'SUPPRESSION', 'UNSUBSCRIBE_LINK', 'LEGAL_SENDER_DETAILS', 'SCHEDULE', 'TEST_SEND', 'RECIPIENT_COUNT', 'TENANT_QUOTA', 'DELIVERABILITY_SHUTDOWN', 'REQUIRED_APPROVAL');

-- CreateEnum
CREATE TYPE "EmailCampaignExperimentVariant" AS ENUM ('SUBJECT', 'PREHEADER', 'SENDER_NAME', 'CONTENT', 'CTA');

-- CreateEnum
CREATE TYPE "EmailCampaignExperimentStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'INSUFFICIENT_EVIDENCE');

-- CreateTable
CREATE TABLE "CrmAudienceSegment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "status" "CrmAudienceSegmentStatus" NOT NULL DEFAULT 'DRAFT',
    "memberCountCache" INTEGER,
    "lastComputedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmAudienceSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaign" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "campaignType" "EmailCampaignType" NOT NULL,
    "status" "EmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" TEXT,
    "objective" TEXT,
    "emergencyStopped" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaignVersion" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "EmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "contentHash" TEXT,
    "audienceRuleHash" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailCampaignVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaignAudience" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "segmentId" TEXT,
    "segmentRules" JSONB,
    "totalMembers" INTEGER NOT NULL DEFAULT 0,
    "consentEligible" INTEGER NOT NULL DEFAULT 0,
    "suppressedCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "duplicatedCount" INTEGER NOT NULL DEFAULT 0,
    "finalSendableCount" INTEGER NOT NULL DEFAULT 0,
    "segmentFreshness" TIMESTAMP(3),
    "computedAt" TIMESTAMP(3),

    CONSTRAINT "EmailCampaignAudience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaignContent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "templateId" TEXT,
    "templateVersionId" TEXT,
    "senderIdentityId" TEXT,
    "replyTo" TEXT,
    "subject" TEXT NOT NULL,
    "preheader" TEXT,
    "htmlBody" TEXT,
    "plainTextBody" TEXT,
    "ctaText" TEXT,
    "ctaUrl" TEXT,
    "utmParameters" JSONB,
    "language" TEXT NOT NULL DEFAULT 'en',
    "complianceFooter" TEXT,
    "unsubscribeLink" TEXT,
    "contentHash" TEXT,

    CONSTRAINT "EmailCampaignContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaignSchedule" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sendNow" BOOLEAN NOT NULL DEFAULT false,
    "scheduledAt" TIMESTAMP(3),
    "timezone" TEXT,
    "batchSize" INTEGER,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "EmailCampaignSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaignApproval" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "approvalType" "EmailCampaignApprovalType" NOT NULL,
    "status" "EmailCampaignApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "contentHash" TEXT,
    "audienceRuleHash" TEXT,
    "recipientCountMin" INTEGER,
    "recipientCountMax" INTEGER,
    "scheduledAtBound" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "EmailCampaignApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaignReadinessCheck" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "checkType" "EmailCampaignReadinessCheckType" NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "message" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailCampaignReadinessCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaignRecipientSnapshot" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sendRunId" TEXT,
    "emailAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "leadId" TEXT,
    "contactId" TEXT,
    "variables" JSONB,
    "experimentVariant" TEXT,
    "consentGranted" BOOLEAN NOT NULL DEFAULT false,
    "snapshottedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailCampaignRecipientSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaignSendRun" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" "EmailCampaignStatus" NOT NULL DEFAULT 'SENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalAttempted" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "emergencyStopped" BOOLEAN NOT NULL DEFAULT false,
    "emailMessageId" TEXT,

    CONSTRAINT "EmailCampaignSendRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaignMetricSnapshot" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "sendRunId" TEXT,
    "attempted" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "bounced" INTEGER NOT NULL DEFAULT 0,
    "complained" INTEGER NOT NULL DEFAULT 0,
    "unsubscribed" INTEGER NOT NULL DEFAULT 0,
    "opened" INTEGER NOT NULL DEFAULT 0,
    "clicked" INTEGER NOT NULL DEFAULT 0,
    "ctaClicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(65,30),
    "limitations" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailCampaignMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCampaignExperiment" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "variantType" "EmailCampaignExperimentVariant" NOT NULL,
    "variantA" JSONB NOT NULL,
    "variantB" JSONB NOT NULL,
    "sampleAllocationPercent" INTEGER NOT NULL DEFAULT 50,
    "primaryMetric" TEXT NOT NULL DEFAULT 'click_rate',
    "minimumSample" INTEGER NOT NULL DEFAULT 100,
    "decisionRule" TEXT,
    "testDurationHours" INTEGER,
    "winnerVariant" TEXT,
    "validityWarnings" JSONB,
    "status" "EmailCampaignExperimentStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "EmailCampaignExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmAudienceSegment_organisationId_brandId_status_idx" ON "CrmAudienceSegment"("organisationId", "brandId", "status");

-- CreateIndex
CREATE INDEX "EmailCampaign_organisationId_brandId_status_idx" ON "EmailCampaign"("organisationId", "brandId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmailCampaignVersion_campaignId_versionNumber_key" ON "EmailCampaignVersion"("campaignId", "versionNumber");

-- CreateIndex
CREATE INDEX "EmailCampaignAudience_campaignId_idx" ON "EmailCampaignAudience"("campaignId");

-- CreateIndex
CREATE INDEX "EmailCampaignContent_campaignId_versionId_idx" ON "EmailCampaignContent"("campaignId", "versionId");

-- CreateIndex
CREATE INDEX "EmailCampaignSchedule_campaignId_idx" ON "EmailCampaignSchedule"("campaignId");

-- CreateIndex
CREATE INDEX "EmailCampaignApproval_campaignId_versionId_idx" ON "EmailCampaignApproval"("campaignId", "versionId");

-- CreateIndex
CREATE INDEX "EmailCampaignReadinessCheck_campaignId_versionId_idx" ON "EmailCampaignReadinessCheck"("campaignId", "versionId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailCampaignRecipientSnapshot_campaignId_versionId_emailAddress_key" ON "EmailCampaignRecipientSnapshot"("campaignId", "versionId", "emailAddress");

-- CreateIndex
CREATE INDEX "EmailCampaignRecipientSnapshot_sendRunId_idx" ON "EmailCampaignRecipientSnapshot"("sendRunId");

-- CreateIndex
CREATE INDEX "EmailCampaignSendRun_campaignId_idx" ON "EmailCampaignSendRun"("campaignId");

-- CreateIndex
CREATE INDEX "EmailCampaignMetricSnapshot_campaignId_computedAt_idx" ON "EmailCampaignMetricSnapshot"("campaignId", "computedAt");

-- CreateIndex
CREATE INDEX "EmailCampaignExperiment_campaignId_idx" ON "EmailCampaignExperiment"("campaignId");

-- AddForeignKey
ALTER TABLE "CrmAudienceSegment" ADD CONSTRAINT "CrmAudienceSegment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmAudienceSegment" ADD CONSTRAINT "CrmAudienceSegment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmAudienceSegment" ADD CONSTRAINT "CrmAudienceSegment_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmAudienceSegment" ADD CONSTRAINT "CrmAudienceSegment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaignVersion" ADD CONSTRAINT "EmailCampaignVersion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaignAudience" ADD CONSTRAINT "EmailCampaignAudience_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaignAudience" ADD CONSTRAINT "EmailCampaignAudience_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "CrmAudienceSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaignContent" ADD CONSTRAINT "EmailCampaignContent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaignSchedule" ADD CONSTRAINT "EmailCampaignSchedule_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaignApproval" ADD CONSTRAINT "EmailCampaignApproval_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaignApproval" ADD CONSTRAINT "EmailCampaignApproval_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaignReadinessCheck" ADD CONSTRAINT "EmailCampaignReadinessCheck_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaignRecipientSnapshot" ADD CONSTRAINT "EmailCampaignRecipientSnapshot_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaignRecipientSnapshot" ADD CONSTRAINT "EmailCampaignRecipientSnapshot_sendRunId_fkey" FOREIGN KEY ("sendRunId") REFERENCES "EmailCampaignSendRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaignSendRun" ADD CONSTRAINT "EmailCampaignSendRun_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaignMetricSnapshot" ADD CONSTRAINT "EmailCampaignMetricSnapshot_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCampaignExperiment" ADD CONSTRAINT "EmailCampaignExperiment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
