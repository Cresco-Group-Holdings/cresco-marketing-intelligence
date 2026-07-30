-- Task 3.6: Marketing attribution engine

CREATE TYPE "AttributionModelType" AS ENUM ('FIRST_TOUCH', 'LAST_TOUCH', 'LINEAR', 'POSITION_BASED', 'TIME_DECAY');
CREATE TYPE "DirectTrafficPolicy" AS ENUM ('RETAIN', 'IGNORE_WHEN_PRIOR_KNOWN', 'SHOW_BOTH');
CREATE TYPE "AttributionTouchpointSource" AS ENUM (
    'WEBSITE_SESSION',
    'SOCIAL_POST_CLICK',
    'PAID_AD_CLICK',
    'ORGANIC_SEARCH',
    'EMAIL_CLICK',
    'REFERRAL',
    'DEMO_BOOKING',
    'CRM_ACTIVITY',
    'DIRECT_VISIT'
);
CREATE TYPE "AttributionRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL');
CREATE TYPE "AttributionJourneyStatus" AS ENUM ('OPEN', 'CONVERTED', 'REFUNDED', 'UNATTRIBUTED');
CREATE TYPE "AttributionExclusionRuleType" AS ENUM ('CHANNEL', 'SOURCE', 'CAMPAIGN', 'TOUCHPOINT_SOURCE', 'CONSENT_MISSING', 'CUSTOM');
CREATE TYPE "AttributionRunTrigger" AS ENUM (
    'MODEL_CHANGE',
    'LATE_EVENT',
    'IDENTITY_CONFIRMED',
    'REFUND',
    'CAMPAIGN_MAPPING_CHANGE',
    'EXCLUSION_RULE_CHANGE',
    'MANUAL',
    'SCHEDULED'
);

CREATE TABLE "AttributionModel" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modelType" "AttributionModelType" NOT NULL,
    "directTrafficPolicy" "DirectTrafficPolicy" NOT NULL DEFAULT 'RETAIN',
    "lookbackWindowDays" INTEGER NOT NULL DEFAULT 90,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currentVersionId" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttributionModel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttributionModelVersion" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "attributionModelId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "modelType" "AttributionModelType" NOT NULL,
    "directTrafficPolicy" "DirectTrafficPolicy" NOT NULL,
    "lookbackWindowDays" INTEGER NOT NULL,
    "config" JSONB,
    "changelog" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributionModelVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttributionJourney" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "identityId" TEXT,
    "conversionEventId" TEXT,
    "conversionDefinitionId" TEXT,
    "revenueRecordId" TEXT,
    "conversionType" TEXT NOT NULL,
    "conversionKey" TEXT,
    "journeyStart" TIMESTAMP(3) NOT NULL,
    "journeyEnd" TIMESTAMP(3),
    "status" "AttributionJourneyStatus" NOT NULL DEFAULT 'OPEN',
    "revenueValue" DECIMAL(24,6),
    "revenueCurrency" TEXT,
    "lookbackWindowDays" INTEGER NOT NULL,
    "directTrafficPolicy" "DirectTrafficPolicy" NOT NULL,
    "limitations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttributionJourney_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttributionTouchpoint" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "attributionJourneyId" TEXT,
    "touchpointSource" "AttributionTouchpointSource" NOT NULL,
    "identityId" TEXT,
    "marketingSessionId" TEXT,
    "marketingEventId" TEXT,
    "marketingCampaignId" TEXT,
    "marketingChannelId" TEXT,
    "marketingContentItemId" TEXT,
    "marketingLandingPageId" TEXT,
    "provider" "MarketingDataProvider",
    "channel" TEXT,
    "campaign" TEXT,
    "contentKey" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "sessionKey" TEXT,
    "landingPage" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "clickId" TEXT,
    "clickIdProvider" TEXT,
    "consentState" JSONB,
    "evidenceStrength" DECIMAL(5,4),
    "isExcluded" BOOLEAN NOT NULL DEFAULT false,
    "exclusionReason" TEXT,
    "position" INTEGER,
    "providerMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributionTouchpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttributionResult" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "attributionJourneyId" TEXT NOT NULL,
    "attributionModelId" TEXT NOT NULL,
    "attributionModelVersionId" TEXT NOT NULL,
    "attributionRunId" TEXT,
    "conversionEventId" TEXT,
    "revenueValue" DECIMAL(24,6) NOT NULL,
    "revenueCurrency" TEXT,
    "totalCreditPercent" DECIMAL(8,4) NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL,
    "limitations" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributionResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttributionCredit" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "attributionResultId" TEXT NOT NULL,
    "attributionTouchpointId" TEXT NOT NULL,
    "creditPercent" DECIMAL(8,4) NOT NULL,
    "creditValue" DECIMAL(24,6),
    "channel" TEXT,
    "campaign" TEXT,
    "contentKey" TEXT,
    "position" INTEGER,
    "wasExcluded" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributionCredit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttributionRun" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "attributionModelId" TEXT NOT NULL,
    "attributionModelVersionId" TEXT NOT NULL,
    "status" "AttributionRunStatus" NOT NULL DEFAULT 'PENDING',
    "triggerReason" "AttributionRunTrigger" NOT NULL,
    "journeysProcessed" INTEGER NOT NULL DEFAULT 0,
    "resultsCreated" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributionRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttributionExclusionRule" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ruleType" "AttributionExclusionRuleType" NOT NULL,
    "matchField" TEXT NOT NULL,
    "matchValue" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttributionExclusionRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttributionModel_brandId_name_key" ON "AttributionModel"("brandId", "name");
CREATE INDEX "AttributionModel_organisationId_brandId_idx" ON "AttributionModel"("organisationId", "brandId");
CREATE INDEX "AttributionModel_isDefault_idx" ON "AttributionModel"("isDefault");

CREATE UNIQUE INDEX "AttributionModelVersion_attributionModelId_versionNumber_key" ON "AttributionModelVersion"("attributionModelId", "versionNumber");
CREATE INDEX "AttributionModelVersion_organisationId_brandId_idx" ON "AttributionModelVersion"("organisationId", "brandId");

CREATE INDEX "AttributionJourney_organisationId_brandId_journeyEnd_idx" ON "AttributionJourney"("organisationId", "brandId", "journeyEnd");
CREATE INDEX "AttributionJourney_identityId_idx" ON "AttributionJourney"("identityId");
CREATE INDEX "AttributionJourney_status_idx" ON "AttributionJourney"("status");

CREATE INDEX "AttributionTouchpoint_organisationId_brandId_occurredAt_idx" ON "AttributionTouchpoint"("organisationId", "brandId", "occurredAt");
CREATE INDEX "AttributionTouchpoint_attributionJourneyId_idx" ON "AttributionTouchpoint"("attributionJourneyId");
CREATE INDEX "AttributionTouchpoint_identityId_idx" ON "AttributionTouchpoint"("identityId");
CREATE INDEX "AttributionTouchpoint_touchpointSource_idx" ON "AttributionTouchpoint"("touchpointSource");

CREATE INDEX "AttributionResult_organisationId_brandId_calculatedAt_idx" ON "AttributionResult"("organisationId", "brandId", "calculatedAt");
CREATE INDEX "AttributionResult_attributionJourneyId_idx" ON "AttributionResult"("attributionJourneyId");
CREATE INDEX "AttributionResult_attributionModelId_idx" ON "AttributionResult"("attributionModelId");

CREATE INDEX "AttributionCredit_organisationId_brandId_idx" ON "AttributionCredit"("organisationId", "brandId");
CREATE INDEX "AttributionCredit_attributionResultId_idx" ON "AttributionCredit"("attributionResultId");
CREATE INDEX "AttributionCredit_channel_idx" ON "AttributionCredit"("channel");

CREATE UNIQUE INDEX "AttributionRun_idempotencyKey_key" ON "AttributionRun"("idempotencyKey");
CREATE INDEX "AttributionRun_organisationId_brandId_createdAt_idx" ON "AttributionRun"("organisationId", "brandId", "createdAt");
CREATE INDEX "AttributionRun_status_idx" ON "AttributionRun"("status");

CREATE UNIQUE INDEX "AttributionExclusionRule_brandId_name_key" ON "AttributionExclusionRule"("brandId", "name");
CREATE INDEX "AttributionExclusionRule_organisationId_brandId_idx" ON "AttributionExclusionRule"("organisationId", "brandId");
CREATE INDEX "AttributionExclusionRule_isActive_idx" ON "AttributionExclusionRule"("isActive");

ALTER TABLE "AttributionModel" ADD CONSTRAINT "AttributionModel_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionModel" ADD CONSTRAINT "AttributionModel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionModel" ADD CONSTRAINT "AttributionModel_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttributionModelVersion" ADD CONSTRAINT "AttributionModelVersion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionModelVersion" ADD CONSTRAINT "AttributionModelVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionModelVersion" ADD CONSTRAINT "AttributionModelVersion_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionModelVersion" ADD CONSTRAINT "AttributionModelVersion_attributionModelId_fkey" FOREIGN KEY ("attributionModelId") REFERENCES "AttributionModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttributionJourney" ADD CONSTRAINT "AttributionJourney_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionJourney" ADD CONSTRAINT "AttributionJourney_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionJourney" ADD CONSTRAINT "AttributionJourney_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionJourney" ADD CONSTRAINT "AttributionJourney_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "MarketingIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AttributionTouchpoint" ADD CONSTRAINT "AttributionTouchpoint_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionTouchpoint" ADD CONSTRAINT "AttributionTouchpoint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionTouchpoint" ADD CONSTRAINT "AttributionTouchpoint_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionTouchpoint" ADD CONSTRAINT "AttributionTouchpoint_attributionJourneyId_fkey" FOREIGN KEY ("attributionJourneyId") REFERENCES "AttributionJourney"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttributionTouchpoint" ADD CONSTRAINT "AttributionTouchpoint_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "MarketingIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AttributionResult" ADD CONSTRAINT "AttributionResult_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionResult" ADD CONSTRAINT "AttributionResult_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionResult" ADD CONSTRAINT "AttributionResult_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionResult" ADD CONSTRAINT "AttributionResult_attributionJourneyId_fkey" FOREIGN KEY ("attributionJourneyId") REFERENCES "AttributionJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionResult" ADD CONSTRAINT "AttributionResult_attributionModelId_fkey" FOREIGN KEY ("attributionModelId") REFERENCES "AttributionModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionResult" ADD CONSTRAINT "AttributionResult_attributionModelVersionId_fkey" FOREIGN KEY ("attributionModelVersionId") REFERENCES "AttributionModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionResult" ADD CONSTRAINT "AttributionResult_attributionRunId_fkey" FOREIGN KEY ("attributionRunId") REFERENCES "AttributionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AttributionCredit" ADD CONSTRAINT "AttributionCredit_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionCredit" ADD CONSTRAINT "AttributionCredit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionCredit" ADD CONSTRAINT "AttributionCredit_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionCredit" ADD CONSTRAINT "AttributionCredit_attributionResultId_fkey" FOREIGN KEY ("attributionResultId") REFERENCES "AttributionResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionCredit" ADD CONSTRAINT "AttributionCredit_attributionTouchpointId_fkey" FOREIGN KEY ("attributionTouchpointId") REFERENCES "AttributionTouchpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttributionRun" ADD CONSTRAINT "AttributionRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionRun" ADD CONSTRAINT "AttributionRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionRun" ADD CONSTRAINT "AttributionRun_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionRun" ADD CONSTRAINT "AttributionRun_attributionModelId_fkey" FOREIGN KEY ("attributionModelId") REFERENCES "AttributionModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionRun" ADD CONSTRAINT "AttributionRun_attributionModelVersionId_fkey" FOREIGN KEY ("attributionModelVersionId") REFERENCES "AttributionModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttributionExclusionRule" ADD CONSTRAINT "AttributionExclusionRule_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionExclusionRule" ADD CONSTRAINT "AttributionExclusionRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttributionExclusionRule" ADD CONSTRAINT "AttributionExclusionRule_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
