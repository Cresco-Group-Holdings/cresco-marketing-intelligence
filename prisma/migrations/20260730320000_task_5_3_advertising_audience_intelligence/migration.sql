-- Task 5.3: Advertising Audience Intelligence

-- CreateEnum
CREATE TYPE "AdvertisingAudienceIntelligenceType" AS ENUM ('PROSPECTING', 'RETARGETING', 'CUSTOMER', 'LEAD', 'TRIAL_USER', 'SUBSCRIBER', 'CHURN_RISK', 'CONTENT_ENGAGER', 'WEBSITE_VISITOR', 'CONVERSION_ABANDONER', 'CUSTOM_RULE_BASED', 'PROVIDER_NATIVE', 'EXCLUSION');

-- CreateEnum
CREATE TYPE "AdvertisingAudienceStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdvertisingAudienceRuleOperator" AS ENUM ('EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN', 'IN', 'NOT_IN', 'OCCURRED_WITHIN', 'NOT_OCCURRED_WITHIN', 'IS_TRUE', 'IS_FALSE');

-- CreateEnum
CREATE TYPE "AdvertisingAudienceExclusionType" AS ENUM ('EXISTING_CUSTOMERS', 'CONVERTED_USERS', 'EMPLOYEES', 'TEST_USERS', 'UNSUBSCRIBED_USERS', 'RECENT_PURCHASERS', 'ALREADY_BOOKED_DEMO', 'ACTIVE_SUBSCRIBERS', 'SUPPRESSED_LEADS');

-- CreateEnum
CREATE TYPE "AdvertisingAudienceEligibilityStatus" AS ENUM ('ELIGIBLE', 'NEEDS_ATTENTION', 'NOT_ELIGIBLE', 'PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "AdvertisingAudienceDataSource" AS ENUM ('CRM', 'LEADS', 'CUSTOMERS', 'WEBSITE_EVENTS', 'CONTENT_ENGAGEMENT', 'PRODUCT_USAGE', 'EMAIL_ACTIVITY', 'CAMPAIGN_INTERACTIONS', 'GEOGRAPHIC', 'DECLARED_INTERESTS', 'PROVIDER_NATIVE');

-- AlterEnum
ALTER TYPE "AIPurpose" ADD VALUE 'ADVERTISING_AUDIENCE';

-- CreateTable
CREATE TABLE "AdvertisingAudience" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "campaignPlanId" TEXT,
    "brandAudienceId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AdvertisingAudienceStatus" NOT NULL DEFAULT 'DRAFT',
    "audienceType" "AdvertisingAudienceIntelligenceType" NOT NULL,
    "retargetingWindowDays" INTEGER,
    "dataSources" "AdvertisingAudienceDataSource"[] DEFAULT ARRAY[]::"AdvertisingAudienceDataSource"[],
    "funnelStage" TEXT,
    "messageAngle" TEXT,
    "currentVersionId" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "AdvertisingAudience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingAudienceVersion" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "AdvertisingAudienceStatus" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeNote" TEXT,
    "aiRequestId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingAudienceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingAudienceRule" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "operator" "AdvertisingAudienceRuleOperator" NOT NULL,
    "value" JSONB NOT NULL,
    "logicGroup" TEXT NOT NULL DEFAULT 'AND',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingAudienceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingAudienceSegment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "segmentLogic" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingAudienceSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingAudienceEstimate" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "eligibleCount" INTEGER,
    "excludedCount" INTEGER,
    "consentCoveredCount" INTEGER,
    "providerMatchNote" TEXT,
    "freshnessAt" TIMESTAMP(3),
    "sourceCoverage" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disclaimer" TEXT NOT NULL DEFAULT 'Counts based on available first-party data only. Provider reach not estimated.',

    CONSTRAINT "AdvertisingAudienceEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingAudienceExclusion" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "exclusionType" "AdvertisingAudienceExclusionType" NOT NULL,
    "description" TEXT,
    "ruleKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingAudienceExclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingAudienceConsentPolicy" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "marketingConsentRequired" BOOLEAN NOT NULL DEFAULT true,
    "dataSources" "AdvertisingAudienceDataSource"[] DEFAULT ARRAY[]::"AdvertisingAudienceDataSource"[],
    "retentionDays" INTEGER,
    "permittedPurpose" TEXT,
    "customerListEligible" BOOLEAN NOT NULL DEFAULT false,
    "deletionExcluded" BOOLEAN NOT NULL DEFAULT true,
    "geoRestrictions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "providerConsentNotes" TEXT,
    "humanBridgeSafeguards" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingAudienceConsentPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingAudienceProviderMapping" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAudienceType" TEXT,
    "eligibilityStatus" "AdvertisingAudienceEligibilityStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "minimumSizeRule" INTEGER,
    "requiredIdentifierType" TEXT,
    "supportedRetentionDays" INTEGER,
    "policyWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActivated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingAudienceProviderMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingAudienceEligibilityCheck" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "checkType" TEXT NOT NULL,
    "status" "AdvertisingAudienceEligibilityStatus" NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'HIGH',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingAudienceEligibilityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvertisingAudience_organisationId_brandId_status_idx" ON "AdvertisingAudience"("organisationId", "brandId", "status");

-- CreateIndex
CREATE INDEX "AdvertisingAudience_campaignPlanId_idx" ON "AdvertisingAudience"("campaignPlanId");

-- CreateIndex
CREATE INDEX "AdvertisingAudienceVersion_audienceId_createdAt_idx" ON "AdvertisingAudienceVersion"("audienceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingAudienceVersion_audienceId_versionNumber_key" ON "AdvertisingAudienceVersion"("audienceId", "versionNumber");

-- CreateIndex
CREATE INDEX "AdvertisingAudienceRule_audienceId_ruleKey_idx" ON "AdvertisingAudienceRule"("audienceId", "ruleKey");

-- CreateIndex
CREATE INDEX "AdvertisingAudienceSegment_audienceId_idx" ON "AdvertisingAudienceSegment"("audienceId");

-- CreateIndex
CREATE INDEX "AdvertisingAudienceEstimate_audienceId_calculatedAt_idx" ON "AdvertisingAudienceEstimate"("audienceId", "calculatedAt");

-- CreateIndex
CREATE INDEX "AdvertisingAudienceExclusion_audienceId_exclusionType_idx" ON "AdvertisingAudienceExclusion"("audienceId", "exclusionType");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingAudienceConsentPolicy_audienceId_key" ON "AdvertisingAudienceConsentPolicy"("audienceId");

-- CreateIndex
CREATE INDEX "AdvertisingAudienceProviderMapping_audienceId_provider_idx" ON "AdvertisingAudienceProviderMapping"("audienceId", "provider");

-- CreateIndex
CREATE INDEX "AdvertisingAudienceEligibilityCheck_audienceId_checkType_idx" ON "AdvertisingAudienceEligibilityCheck"("audienceId", "checkType");

-- AddForeignKey
ALTER TABLE "AdvertisingAudience" ADD CONSTRAINT "AdvertisingAudience_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudience" ADD CONSTRAINT "AdvertisingAudience_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudience" ADD CONSTRAINT "AdvertisingAudience_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudience" ADD CONSTRAINT "AdvertisingAudience_campaignPlanId_fkey" FOREIGN KEY ("campaignPlanId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudience" ADD CONSTRAINT "AdvertisingAudience_brandAudienceId_fkey" FOREIGN KEY ("brandAudienceId") REFERENCES "BrandAudience"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudience" ADD CONSTRAINT "AdvertisingAudience_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudience" ADD CONSTRAINT "AdvertisingAudience_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudienceVersion" ADD CONSTRAINT "AdvertisingAudienceVersion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudienceVersion" ADD CONSTRAINT "AdvertisingAudienceVersion_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "AdvertisingAudience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudienceVersion" ADD CONSTRAINT "AdvertisingAudienceVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudienceRule" ADD CONSTRAINT "AdvertisingAudienceRule_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudienceRule" ADD CONSTRAINT "AdvertisingAudienceRule_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "AdvertisingAudience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudienceSegment" ADD CONSTRAINT "AdvertisingAudienceSegment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudienceSegment" ADD CONSTRAINT "AdvertisingAudienceSegment_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "AdvertisingAudience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudienceEstimate" ADD CONSTRAINT "AdvertisingAudienceEstimate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudienceEstimate" ADD CONSTRAINT "AdvertisingAudienceEstimate_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "AdvertisingAudience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudienceExclusion" ADD CONSTRAINT "AdvertisingAudienceExclusion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudienceExclusion" ADD CONSTRAINT "AdvertisingAudienceExclusion_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "AdvertisingAudience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudienceConsentPolicy" ADD CONSTRAINT "AdvertisingAudienceConsentPolicy_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudienceConsentPolicy" ADD CONSTRAINT "AdvertisingAudienceConsentPolicy_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "AdvertisingAudience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudienceProviderMapping" ADD CONSTRAINT "AdvertisingAudienceProviderMapping_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudienceProviderMapping" ADD CONSTRAINT "AdvertisingAudienceProviderMapping_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "AdvertisingAudience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudienceEligibilityCheck" ADD CONSTRAINT "AdvertisingAudienceEligibilityCheck_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAudienceEligibilityCheck" ADD CONSTRAINT "AdvertisingAudienceEligibilityCheck_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "AdvertisingAudience"("id") ON DELETE CASCADE ON UPDATE CASCADE;
