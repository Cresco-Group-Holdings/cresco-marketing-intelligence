-- Task 2.14: Marketing leads

ALTER TYPE "AIPurpose" ADD VALUE IF NOT EXISTS 'LEAD_QUALIFICATION_SUGGEST';

CREATE TYPE "MarketingLeadStatus" AS ENUM ('NEW', 'REVIEWING', 'QUALIFIED', 'UNQUALIFIED', 'CONTACTED', 'CONVERTED', 'CLOSED', 'DELETED');
CREATE TYPE "LeadCreationSource" AS ENUM ('SOCIAL_COMMENT', 'SOCIAL_MESSAGE', 'SOCIAL_MENTION', 'LEAD_FORM', 'LANDING_PAGE_FORM', 'MANUAL');
CREATE TYPE "LeadQualificationProfile" AS ENUM ('CRESCO_GRANTS_INTELLIGENCE', 'CAPITAL_CRESCO_TERMINAL');
CREATE TYPE "LeadConsentState" AS ENUM ('UNKNOWN', 'GRANTED', 'DENIED', 'WITHDRAWN');
CREATE TYPE "LeadRetentionStatus" AS ENUM ('ACTIVE', 'SCHEDULED_FOR_DELETION', 'DELETED', 'SUPPRESSED');
CREATE TYPE "CrmProvider" AS ENUM ('HUBSPOT', 'SALESFORCE', 'PIPEDRIVE', 'CRESCO_INTERNAL', 'WEBHOOK', 'CSV', 'FAKE');
CREATE TYPE "CrmHandoffStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
CREATE TYPE "LeadActivityType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'QUALIFICATION_UPDATED', 'CONSENT_UPDATED', 'NOTE_ADDED', 'CRM_HANDOFF', 'EXPORTED', 'DELETED', 'SUPPRESSED');

CREATE TABLE "MarketingLead" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "status" "MarketingLeadStatus" NOT NULL DEFAULT 'NEW',
  "displayName" TEXT,
  "providerUsername" TEXT,
  "providerProfileUrl" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "company" TEXT,
  "jobRole" TEXT,
  "country" TEXT,
  "expressedInterest" TEXT,
  "sourcePlatform" "SocialProvider",
  "sourcePostId" TEXT,
  "sourceCampaign" TEXT,
  "originalInteraction" TEXT,
  "socialConversationId" TEXT,
  "socialAccountId" TEXT,
  "contentItemId" TEXT,
  "primaryCta" TEXT,
  "destinationUrl" TEXT,
  "conversionEventId" TEXT,
  "firstInteractionAt" TIMESTAMP(3),
  "latestInteractionAt" TIMESTAMP(3),
  "assignedToUserId" TEXT,
  "duplicateOfLeadId" TEXT,
  "isDuplicateWarning" BOOLEAN NOT NULL DEFAULT false,
  "retentionStatus" "LeadRetentionStatus" NOT NULL DEFAULT 'ACTIVE',
  "lawfulBasisPlaceholder" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingLead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadSource" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "marketingLeadId" TEXT NOT NULL,
  "creationSource" "LeadCreationSource" NOT NULL,
  "provider" "SocialProvider",
  "socialAccountId" TEXT,
  "providerPostId" TEXT,
  "contentItemId" TEXT,
  "campaignName" TEXT,
  "cta" TEXT,
  "destinationUrl" TEXT,
  "interactionReference" TEXT,
  "metadata" JSONB,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadActivity" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "marketingLeadId" TEXT NOT NULL,
  "activityType" "LeadActivityType" NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadQualification" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "marketingLeadId" TEXT NOT NULL,
  "profile" "LeadQualificationProfile" NOT NULL,
  "answers" JSONB NOT NULL DEFAULT '{}',
  "score" INTEGER,
  "qualified" BOOLEAN,
  "aiSuggested" BOOLEAN NOT NULL DEFAULT false,
  "aiRequestId" TEXT,
  "requiresReview" BOOLEAN NOT NULL DEFAULT true,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadQualification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadConsent" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "marketingLeadId" TEXT NOT NULL,
  "consentState" "LeadConsentState" NOT NULL DEFAULT 'UNKNOWN',
  "lawfulBasis" TEXT,
  "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
  "suppressed" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "recordedByUserId" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadAssignment" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "marketingLeadId" TEXT NOT NULL,
  "assignedToId" TEXT NOT NULL,
  "assignedById" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadExport" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "filters" JSONB,
  "requestedById" TEXT NOT NULL,
  "fileName" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadExport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmHandoff" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "marketingLeadId" TEXT NOT NULL,
  "provider" "CrmProvider" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" "CrmHandoffStatus" NOT NULL DEFAULT 'PENDING',
  "externalId" TEXT,
  "errorMessage" TEXT,
  "payload" JSONB,
  "response" JSONB,
  "attemptedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmHandoff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadSource_marketingLeadId_key" ON "LeadSource"("marketingLeadId");
CREATE UNIQUE INDEX "LeadQualification_marketingLeadId_profile_key" ON "LeadQualification"("marketingLeadId", "profile");
CREATE UNIQUE INDEX "CrmHandoff_marketingLeadId_provider_idempotencyKey_key" ON "CrmHandoff"("marketingLeadId", "provider", "idempotencyKey");

CREATE INDEX "MarketingLead_organisationId_brandId_status_idx" ON "MarketingLead"("organisationId", "brandId", "status");
CREATE INDEX "MarketingLead_brandId_createdAt_idx" ON "MarketingLead"("brandId", "createdAt");
CREATE INDEX "MarketingLead_email_idx" ON "MarketingLead"("email");
CREATE INDEX "MarketingLead_phone_idx" ON "MarketingLead"("phone");
CREATE INDEX "MarketingLead_providerUsername_sourcePlatform_idx" ON "MarketingLead"("providerUsername", "sourcePlatform");
CREATE INDEX "MarketingLead_socialConversationId_idx" ON "MarketingLead"("socialConversationId");
CREATE INDEX "MarketingLead_assignedToUserId_idx" ON "MarketingLead"("assignedToUserId");
CREATE INDEX "MarketingLead_retentionStatus_idx" ON "MarketingLead"("retentionStatus");

ALTER TABLE "MarketingLead" ADD CONSTRAINT "MarketingLead_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingLead" ADD CONSTRAINT "MarketingLead_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingLead" ADD CONSTRAINT "MarketingLead_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingLead" ADD CONSTRAINT "MarketingLead_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingLead" ADD CONSTRAINT "MarketingLead_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingLead" ADD CONSTRAINT "MarketingLead_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketingLead" ADD CONSTRAINT "MarketingLead_duplicateOfLeadId_fkey" FOREIGN KEY ("duplicateOfLeadId") REFERENCES "MarketingLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadSource" ADD CONSTRAINT "LeadSource_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadSource" ADD CONSTRAINT "LeadSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadSource" ADD CONSTRAINT "LeadSource_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadSource" ADD CONSTRAINT "LeadSource_marketingLeadId_fkey" FOREIGN KEY ("marketingLeadId") REFERENCES "MarketingLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_marketingLeadId_fkey" FOREIGN KEY ("marketingLeadId") REFERENCES "MarketingLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadQualification" ADD CONSTRAINT "LeadQualification_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadQualification" ADD CONSTRAINT "LeadQualification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadQualification" ADD CONSTRAINT "LeadQualification_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadQualification" ADD CONSTRAINT "LeadQualification_marketingLeadId_fkey" FOREIGN KEY ("marketingLeadId") REFERENCES "MarketingLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadQualification" ADD CONSTRAINT "LeadQualification_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadConsent" ADD CONSTRAINT "LeadConsent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadConsent" ADD CONSTRAINT "LeadConsent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadConsent" ADD CONSTRAINT "LeadConsent_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadConsent" ADD CONSTRAINT "LeadConsent_marketingLeadId_fkey" FOREIGN KEY ("marketingLeadId") REFERENCES "MarketingLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_marketingLeadId_fkey" FOREIGN KEY ("marketingLeadId") REFERENCES "MarketingLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeadExport" ADD CONSTRAINT "LeadExport_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadExport" ADD CONSTRAINT "LeadExport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadExport" ADD CONSTRAINT "LeadExport_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadExport" ADD CONSTRAINT "LeadExport_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrmHandoff" ADD CONSTRAINT "CrmHandoff_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmHandoff" ADD CONSTRAINT "CrmHandoff_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmHandoff" ADD CONSTRAINT "CrmHandoff_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmHandoff" ADD CONSTRAINT "CrmHandoff_marketingLeadId_fkey" FOREIGN KEY ("marketingLeadId") REFERENCES "MarketingLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
