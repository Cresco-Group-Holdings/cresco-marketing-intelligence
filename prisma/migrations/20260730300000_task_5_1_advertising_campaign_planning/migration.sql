-- Task 5.1: Advertising campaign planning foundation

-- CreateEnum
CREATE TYPE "AdvertisingCampaignPlanStatus" AS ENUM ('DRAFT', 'PLANNING', 'READY_FOR_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'PROVIDER_CONFIGURATION', 'READY_TO_LAUNCH', 'LAUNCHED', 'PAUSED', 'COMPLETED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdvertisingPlanObjectiveType" AS ENUM ('BRAND_AWARENESS', 'REACH', 'VIDEO_VIEWS', 'WEBSITE_TRAFFIC', 'ENGAGEMENT', 'LEAD_GENERATION', 'DEMO_REQUESTS', 'APP_SIGNUPS', 'TRIAL_STARTS', 'SUBSCRIPTIONS', 'PURCHASES', 'RETARGETING', 'CUSTOMER_RETENTION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AdvertisingChannelType" AS ENUM ('GOOGLE_SEARCH', 'GOOGLE_DISPLAY', 'GOOGLE_VIDEO', 'GOOGLE_PERFORMANCE_MAX', 'META_FACEBOOK', 'META_INSTAGRAM', 'LINKEDIN', 'TIKTOK', 'YOUTUBE', 'X', 'OTHER');

-- CreateEnum
CREATE TYPE "AdvertisingBudgetType" AS ENUM ('DAILY', 'LIFETIME', 'MONTHLY', 'FLIGHT', 'MANUAL_ALLOCATION');

-- CreateEnum
CREATE TYPE "AdvertisingBudgetPacing" AS ENUM ('EVEN', 'ACCELERATED', 'STANDARD');

-- CreateEnum
CREATE TYPE "AdvertisingDestinationType" AS ENUM ('WEBSITE_PAGE', 'LANDING_PAGE', 'LEAD_FORM', 'APP_PAGE', 'VIDEO', 'PROFILE', 'MESSAGING_DESTINATION', 'PHONE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AdvertisingAudienceType" AS ENUM ('BROAD', 'DEMOGRAPHIC', 'GEOGRAPHIC', 'INTEREST', 'JOB_ROLE', 'COMPANY', 'INDUSTRY', 'KEYWORD', 'CUSTOM_LIST', 'WEBSITE_VISITORS', 'VIDEO_VIEWERS', 'CUSTOMER_LIST', 'LOOKALIKE', 'RETARGETING', 'EXCLUSION', 'PROVIDER_SPECIFIC');

-- CreateEnum
CREATE TYPE "AdvertisingPlacementMode" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "AdvertisingReadinessStatus" AS ENUM ('NOT_READY', 'NEEDS_ATTENTION', 'READY_FOR_REVIEW', 'READY_TO_LAUNCH');

-- CreateEnum
CREATE TYPE "AdvertisingApprovalType" AS ENUM ('STRATEGY', 'BUDGET', 'AUDIENCE', 'CREATIVE', 'COMPLIANCE', 'LAUNCH');

-- CreateEnum
CREATE TYPE "AdvertisingApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AdvertisingChannelEligibility" AS ENUM ('ELIGIBLE', 'NEEDS_ACCOUNT', 'NEEDS_CREATIVE', 'UNSUPPORTED', 'WARNING');

-- AlterEnum
ALTER TYPE "AIPurpose" ADD VALUE 'ADVERTISING_PLANNING';

-- CreateTable
CREATE TABLE "AdvertisingCampaignPlan" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "internalCampaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AdvertisingCampaignPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "primaryObjective" "AdvertisingPlanObjectiveType",
    "ownerUserId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "reportingCurrency" TEXT NOT NULL DEFAULT 'USD',
    "totalBudgetAmount" DECIMAL(18,4),
    "currentVersionId" TEXT,
    "namingTemplate" TEXT,
    "namingPreview" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "AdvertisingCampaignPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCampaignPlanVersion" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "AdvertisingCampaignPlanStatus" NOT NULL,
    "structuredOutput" JSONB NOT NULL,
    "evidenceSummary" JSONB,
    "assumptions" JSONB,
    "limitations" TEXT,
    "aiRequestId" TEXT,
    "aiModel" TEXT,
    "aiProvider" TEXT,
    "changeNote" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingCampaignPlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCampaignObjective" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "objectiveType" "AdvertisingPlanObjectiveType" NOT NULL,
    "primaryConversion" TEXT,
    "supportingMetrics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "successCriteria" TEXT,
    "targetAudienceSummary" TEXT,
    "destinationSummary" TEXT,
    "attributionExpectations" TEXT,
    "measurementLimitations" TEXT,
    "marketingObjectiveId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCampaignObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCampaignChannel" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "channelType" "AdvertisingChannelType" NOT NULL,
    "provider" TEXT,
    "intendedCampaignType" TEXT,
    "eligibilityStatus" "AdvertisingChannelEligibility" NOT NULL DEFAULT 'ELIGIBLE',
    "requiredAccountId" TEXT,
    "requiredCreativeFormats" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredDestination" TEXT,
    "conversionTracking" TEXT,
    "unsupportedWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCampaignChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCampaignBudget" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "channelId" TEXT,
    "budgetType" "AdvertisingBudgetType" NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "minimumAmount" DECIMAL(18,4),
    "maximumAmount" DECIMAL(18,4),
    "channelAllocation" DECIMAL(18,4),
    "reserveAmount" DECIMAL(18,4),
    "pacingMethod" "AdvertisingBudgetPacing" NOT NULL DEFAULT 'EVEN',
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "approvalThreshold" DECIMAL(18,4),
    "budgetOwnerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCampaignBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCampaignSchedule" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "dayOfWeekSchedule" JSONB,
    "hourOfDaySchedule" JSONB,
    "launchWindowStart" TIMESTAMP(3),
    "launchWindowEnd" TIMESTAMP(3),
    "embargoUntil" TIMESTAMP(3),
    "blackoutDates" TIMESTAMP(3)[] DEFAULT ARRAY[]::TIMESTAMP(3)[],
    "providerTimezoneWarning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCampaignSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCampaignDestination" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "destinationType" "AdvertisingDestinationType" NOT NULL,
    "destinationUrl" TEXT,
    "trackingParameters" JSONB,
    "utmTemplate" TEXT,
    "mobileUrl" TEXT,
    "crawlPageId" TEXT,
    "pageVerified" BOOLEAN NOT NULL DEFAULT false,
    "httpsStatus" BOOLEAN,
    "conversionReady" BOOLEAN NOT NULL DEFAULT false,
    "pageHealthSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCampaignDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCampaignConversionGoal" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "conversionDefinitionId" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "conversionValue" DECIMAL(18,4),
    "valueCurrency" TEXT,
    "attributionModel" TEXT,
    "measurementSource" TEXT,
    "serverSideTrackingStatus" TEXT,
    "providerTrackingStatus" TEXT,
    "dataQualityWarning" TEXT,
    "trackingVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCampaignConversionGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCampaignAudiencePlan" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "audienceType" "AdvertisingAudienceType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logicSpec" JSONB NOT NULL,
    "brandAudienceId" TEXT,
    "estimatedSize" INTEGER,
    "isExclusion" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCampaignAudiencePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCampaignPlacementPlan" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "channelId" TEXT,
    "placementMode" "AdvertisingPlacementMode" NOT NULL DEFAULT 'AUTOMATIC',
    "devices" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "networks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "feeds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "placements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "providerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCampaignPlacementPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCampaignCreativePlan" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "aspectRatio" TEXT,
    "durationSeconds" INTEGER,
    "headline" TEXT,
    "description" TEXT,
    "cta" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "destinationId" TEXT,
    "contentItemId" TEXT,
    "contentVariantId" TEXT,
    "marketingAssetId" TEXT,
    "placementCompatibility" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "copyRequirements" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCampaignCreativePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCampaignReadinessCheck" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "checkType" TEXT NOT NULL,
    "status" "AdvertisingReadinessStatus" NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingCampaignReadinessCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCampaignApproval" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "versionId" TEXT,
    "approvalType" "AdvertisingApprovalType" NOT NULL,
    "decision" "AdvertisingApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT NOT NULL,
    "approverUserId" TEXT,
    "decisionNote" TEXT,
    "budgetThreshold" DECIMAL(18,4),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCampaignApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCampaignProviderDraft" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "channelType" "AdvertisingChannelType" NOT NULL,
    "draftPayload" JSONB NOT NULL,
    "validationResult" JSONB,
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "providerAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCampaignProviderDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvertisingCampaignPlan_organisationId_brandId_status_idx" ON "AdvertisingCampaignPlan"("organisationId", "brandId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingCampaignPlan_brandId_internalCampaignId_key" ON "AdvertisingCampaignPlan"("brandId", "internalCampaignId");

-- CreateIndex
CREATE INDEX "AdvertisingCampaignPlanVersion_planId_createdAt_idx" ON "AdvertisingCampaignPlanVersion"("planId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingCampaignPlanVersion_planId_versionNumber_key" ON "AdvertisingCampaignPlanVersion"("planId", "versionNumber");

-- CreateIndex
CREATE INDEX "AdvertisingCampaignObjective_planId_idx" ON "AdvertisingCampaignObjective"("planId");

-- CreateIndex
CREATE INDEX "AdvertisingCampaignChannel_planId_channelType_idx" ON "AdvertisingCampaignChannel"("planId", "channelType");

-- CreateIndex
CREATE INDEX "AdvertisingCampaignBudget_planId_idx" ON "AdvertisingCampaignBudget"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingCampaignSchedule_planId_key" ON "AdvertisingCampaignSchedule"("planId");

-- CreateIndex
CREATE INDEX "AdvertisingCampaignDestination_planId_idx" ON "AdvertisingCampaignDestination"("planId");

-- CreateIndex
CREATE INDEX "AdvertisingCampaignConversionGoal_planId_isPrimary_idx" ON "AdvertisingCampaignConversionGoal"("planId", "isPrimary");

-- CreateIndex
CREATE INDEX "AdvertisingCampaignAudiencePlan_planId_idx" ON "AdvertisingCampaignAudiencePlan"("planId");

-- CreateIndex
CREATE INDEX "AdvertisingCampaignPlacementPlan_planId_idx" ON "AdvertisingCampaignPlacementPlan"("planId");

-- CreateIndex
CREATE INDEX "AdvertisingCampaignCreativePlan_planId_approvalStatus_idx" ON "AdvertisingCampaignCreativePlan"("planId", "approvalStatus");

-- CreateIndex
CREATE INDEX "AdvertisingCampaignReadinessCheck_planId_status_idx" ON "AdvertisingCampaignReadinessCheck"("planId", "status");

-- CreateIndex
CREATE INDEX "AdvertisingCampaignApproval_planId_approvalType_decision_idx" ON "AdvertisingCampaignApproval"("planId", "approvalType", "decision");

-- CreateIndex
CREATE INDEX "AdvertisingCampaignProviderDraft_planId_provider_idx" ON "AdvertisingCampaignProviderDraft"("planId", "provider");

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignPlan" ADD CONSTRAINT "AdvertisingCampaignPlan_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignPlan" ADD CONSTRAINT "AdvertisingCampaignPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignPlan" ADD CONSTRAINT "AdvertisingCampaignPlan_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignPlan" ADD CONSTRAINT "AdvertisingCampaignPlan_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignPlan" ADD CONSTRAINT "AdvertisingCampaignPlan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignPlanVersion" ADD CONSTRAINT "AdvertisingCampaignPlanVersion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignPlanVersion" ADD CONSTRAINT "AdvertisingCampaignPlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignObjective" ADD CONSTRAINT "AdvertisingCampaignObjective_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignObjective" ADD CONSTRAINT "AdvertisingCampaignObjective_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignObjective" ADD CONSTRAINT "AdvertisingCampaignObjective_marketingObjectiveId_fkey" FOREIGN KEY ("marketingObjectiveId") REFERENCES "MarketingObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignChannel" ADD CONSTRAINT "AdvertisingCampaignChannel_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignChannel" ADD CONSTRAINT "AdvertisingCampaignChannel_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignBudget" ADD CONSTRAINT "AdvertisingCampaignBudget_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignBudget" ADD CONSTRAINT "AdvertisingCampaignBudget_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignBudget" ADD CONSTRAINT "AdvertisingCampaignBudget_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "AdvertisingCampaignChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignBudget" ADD CONSTRAINT "AdvertisingCampaignBudget_budgetOwnerUserId_fkey" FOREIGN KEY ("budgetOwnerUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignSchedule" ADD CONSTRAINT "AdvertisingCampaignSchedule_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignSchedule" ADD CONSTRAINT "AdvertisingCampaignSchedule_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignDestination" ADD CONSTRAINT "AdvertisingCampaignDestination_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignDestination" ADD CONSTRAINT "AdvertisingCampaignDestination_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignDestination" ADD CONSTRAINT "AdvertisingCampaignDestination_crawlPageId_fkey" FOREIGN KEY ("crawlPageId") REFERENCES "SeoCrawlPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignConversionGoal" ADD CONSTRAINT "AdvertisingCampaignConversionGoal_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignConversionGoal" ADD CONSTRAINT "AdvertisingCampaignConversionGoal_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignConversionGoal" ADD CONSTRAINT "AdvertisingCampaignConversionGoal_conversionDefinitionId_fkey" FOREIGN KEY ("conversionDefinitionId") REFERENCES "MarketingConversionDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignAudiencePlan" ADD CONSTRAINT "AdvertisingCampaignAudiencePlan_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignAudiencePlan" ADD CONSTRAINT "AdvertisingCampaignAudiencePlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignAudiencePlan" ADD CONSTRAINT "AdvertisingCampaignAudiencePlan_brandAudienceId_fkey" FOREIGN KEY ("brandAudienceId") REFERENCES "BrandAudience"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignPlacementPlan" ADD CONSTRAINT "AdvertisingCampaignPlacementPlan_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignPlacementPlan" ADD CONSTRAINT "AdvertisingCampaignPlacementPlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignPlacementPlan" ADD CONSTRAINT "AdvertisingCampaignPlacementPlan_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "AdvertisingCampaignChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignCreativePlan" ADD CONSTRAINT "AdvertisingCampaignCreativePlan_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignCreativePlan" ADD CONSTRAINT "AdvertisingCampaignCreativePlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignCreativePlan" ADD CONSTRAINT "AdvertisingCampaignCreativePlan_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignCreativePlan" ADD CONSTRAINT "AdvertisingCampaignCreativePlan_contentVariantId_fkey" FOREIGN KEY ("contentVariantId") REFERENCES "ContentVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignCreativePlan" ADD CONSTRAINT "AdvertisingCampaignCreativePlan_marketingAssetId_fkey" FOREIGN KEY ("marketingAssetId") REFERENCES "MarketingAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignReadinessCheck" ADD CONSTRAINT "AdvertisingCampaignReadinessCheck_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignReadinessCheck" ADD CONSTRAINT "AdvertisingCampaignReadinessCheck_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignApproval" ADD CONSTRAINT "AdvertisingCampaignApproval_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignApproval" ADD CONSTRAINT "AdvertisingCampaignApproval_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignApproval" ADD CONSTRAINT "AdvertisingCampaignApproval_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "AdvertisingCampaignPlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignApproval" ADD CONSTRAINT "AdvertisingCampaignApproval_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignApproval" ADD CONSTRAINT "AdvertisingCampaignApproval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignProviderDraft" ADD CONSTRAINT "AdvertisingCampaignProviderDraft_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignProviderDraft" ADD CONSTRAINT "AdvertisingCampaignProviderDraft_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
