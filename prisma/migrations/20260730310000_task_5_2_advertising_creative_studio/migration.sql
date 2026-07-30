-- Task 5.2: AI Advertising Creative Studio

-- CreateEnum
CREATE TYPE "AdvertisingCreativeFormatType" AS ENUM ('SEARCH_TEXT_AD', 'RESPONSIVE_SEARCH_AD', 'DISPLAY_BANNER', 'SINGLE_IMAGE', 'CAROUSEL', 'STORY', 'REEL', 'SHORT_VIDEO', 'LONG_VIDEO', 'LEAD_FORM_AD', 'DOCUMENT_AD', 'MESSAGE_AD', 'COLLECTION', 'PERFORMANCE_MAX_ASSET', 'PROVIDER_EXTENSION');

-- CreateEnum
CREATE TYPE "AdvertisingCreativeConceptCategory" AS ENUM ('PROBLEM_SOLUTION', 'BENEFIT_LED', 'EVIDENCE_LED', 'PRODUCT_DEMONSTRATION', 'CUSTOMER_STORY', 'COMPARISON', 'EDUCATIONAL', 'FOUNDER_LED', 'URGENCY', 'OBJECTION_HANDLING', 'SOCIAL_PROOF', 'FEATURE_HIGHLIGHT');

-- CreateEnum
CREATE TYPE "AdvertisingCreativeProjectStatus" AS ENUM ('DRAFT', 'GENERATING', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdvertisingCreativeReviewDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "AdvertisingCreativeReviewRole" AS ENUM ('MARKETER', 'BRAND_OWNER', 'COMPLIANCE_REVIEWER', 'BUDGET_OWNER', 'CLIENT_APPROVER');

-- CreateEnum
CREATE TYPE "AdvertisingCreativeValidationStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'WARNING');

-- CreateEnum
CREATE TYPE "AdvertisingCreativeAssetSource" AS ENUM ('ASSET_LIBRARY', 'AI_IMAGE_STUDIO', 'AI_CAROUSEL_STUDIO', 'AI_VIDEO_PIPELINE', 'UPLOAD', 'EXTERNAL');

-- AlterEnum
ALTER TYPE "AIPurpose" ADD VALUE 'ADVERTISING_CREATIVE';

-- CreateTable
CREATE TABLE "AdvertisingCreativeProject" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "campaignPlanId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AdvertisingCreativeProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "primaryFormat" "AdvertisingCreativeFormatType",
    "channelType" "AdvertisingChannelType",
    "objectiveType" "AdvertisingPlanObjectiveType",
    "audienceSummary" TEXT,
    "placementSummary" TEXT,
    "offerSummary" TEXT,
    "currentVersionId" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "AdvertisingCreativeProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCreativeConcept" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "creativeProjectId" TEXT NOT NULL,
    "category" "AdvertisingCreativeConceptCategory" NOT NULL,
    "campaignObjective" TEXT,
    "audienceSummary" TEXT,
    "message" TEXT NOT NULL,
    "visualDirection" TEXT,
    "cta" TEXT,
    "hypothesis" TEXT,
    "complianceRisk" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCreativeConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCreativeVariant" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "creativeProjectId" TEXT NOT NULL,
    "conceptId" TEXT,
    "hypothesis" TEXT,
    "variantLabel" TEXT NOT NULL,
    "hook" TEXT,
    "headline" TEXT,
    "primaryText" TEXT,
    "visualDirection" TEXT,
    "cta" TEXT,
    "audienceRef" TEXT,
    "placementRef" TEXT,
    "offerRef" TEXT,
    "landingPageRef" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCreativeVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCreativeCopy" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "creativeProjectId" TEXT NOT NULL,
    "variantId" TEXT,
    "fieldKey" TEXT NOT NULL,
    "fieldValue" TEXT NOT NULL,
    "characterCount" INTEGER NOT NULL DEFAULT 0,
    "maxLength" INTEGER,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "providerLimit" INTEGER,
    "truncationWarning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCreativeCopy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCreativeAsset" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "creativeProjectId" TEXT NOT NULL,
    "variantId" TEXT,
    "marketingAssetId" TEXT,
    "visualProjectId" TEXT,
    "source" "AdvertisingCreativeAssetSource" NOT NULL,
    "formatType" "AdvertisingCreativeFormatType",
    "aspectRatio" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" INTEGER,
    "fileSizeBytes" INTEGER,
    "mimeType" TEXT,
    "provenanceLabel" TEXT,
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "syntheticDisclaimer" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCreativeAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCreativeFormat" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "creativeProjectId" TEXT NOT NULL,
    "formatType" "AdvertisingCreativeFormatType" NOT NULL,
    "channelType" "AdvertisingChannelType",
    "aspectRatio" TEXT,
    "resolution" TEXT,
    "maxFileSizeBytes" INTEGER,
    "maxDurationSeconds" INTEGER,
    "textLimits" JSONB,
    "safeZones" JSONB,
    "audioRequired" BOOLEAN NOT NULL DEFAULT false,
    "subtitlesRequired" BOOLEAN NOT NULL DEFAULT false,
    "thumbnailRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCreativeFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCreativeReview" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "creativeProjectId" TEXT NOT NULL,
    "versionId" TEXT,
    "reviewerRole" "AdvertisingCreativeReviewRole" NOT NULL,
    "decision" "AdvertisingCreativeReviewDecision" NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT,
    "comment" TEXT,
    "lockedSections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewerUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCreativeReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCreativeVersion" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "creativeProjectId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "AdvertisingCreativeProjectStatus" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeNote" TEXT,
    "aiRequestId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingCreativeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCreativeProviderValidation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "creativeProjectId" TEXT NOT NULL,
    "formatId" TEXT,
    "provider" TEXT NOT NULL,
    "channelType" "AdvertisingChannelType",
    "validationStatus" "AdvertisingCreativeValidationStatus" NOT NULL DEFAULT 'PENDING',
    "isLocalPrecheck" BOOLEAN NOT NULL DEFAULT true,
    "fieldResults" JSONB,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCreativeProviderValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCreativePerformanceLink" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "creativeProjectId" TEXT NOT NULL,
    "variantId" TEXT,
    "marketingCreativeId" TEXT,
    "providerCreativeId" TEXT,
    "provider" TEXT,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "conversions" INTEGER,
    "cost" DECIMAL(18,4),
    "revenue" DECIMAL(18,4),
    "experimentVariant" TEXT,
    "linkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCreativePerformanceLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvertisingCreativeProject_organisationId_brandId_status_idx" ON "AdvertisingCreativeProject"("organisationId", "brandId", "status");

-- CreateIndex
CREATE INDEX "AdvertisingCreativeProject_campaignPlanId_idx" ON "AdvertisingCreativeProject"("campaignPlanId");

-- CreateIndex
CREATE INDEX "AdvertisingCreativeConcept_creativeProjectId_category_idx" ON "AdvertisingCreativeConcept"("creativeProjectId", "category");

-- CreateIndex
CREATE INDEX "AdvertisingCreativeVariant_creativeProjectId_conceptId_idx" ON "AdvertisingCreativeVariant"("creativeProjectId", "conceptId");

-- CreateIndex
CREATE INDEX "AdvertisingCreativeCopy_creativeProjectId_variantId_fieldKe_idx" ON "AdvertisingCreativeCopy"("creativeProjectId", "variantId", "fieldKey");

-- CreateIndex
CREATE INDEX "AdvertisingCreativeAsset_creativeProjectId_variantId_idx" ON "AdvertisingCreativeAsset"("creativeProjectId", "variantId");

-- CreateIndex
CREATE INDEX "AdvertisingCreativeFormat_creativeProjectId_formatType_idx" ON "AdvertisingCreativeFormat"("creativeProjectId", "formatType");

-- CreateIndex
CREATE INDEX "AdvertisingCreativeReview_creativeProjectId_reviewerRole_de_idx" ON "AdvertisingCreativeReview"("creativeProjectId", "reviewerRole", "decision");

-- CreateIndex
CREATE INDEX "AdvertisingCreativeVersion_creativeProjectId_createdAt_idx" ON "AdvertisingCreativeVersion"("creativeProjectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingCreativeVersion_creativeProjectId_versionNumber_key" ON "AdvertisingCreativeVersion"("creativeProjectId", "versionNumber");

-- CreateIndex
CREATE INDEX "AdvertisingCreativeProviderValidation_creativeProjectId_pro_idx" ON "AdvertisingCreativeProviderValidation"("creativeProjectId", "provider");

-- CreateIndex
CREATE INDEX "AdvertisingCreativePerformanceLink_creativeProjectId_varian_idx" ON "AdvertisingCreativePerformanceLink"("creativeProjectId", "variantId");

-- CreateIndex
CREATE INDEX "AdvertisingCreativePerformanceLink_marketingCreativeId_idx" ON "AdvertisingCreativePerformanceLink"("marketingCreativeId");

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeProject" ADD CONSTRAINT "AdvertisingCreativeProject_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeProject" ADD CONSTRAINT "AdvertisingCreativeProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeProject" ADD CONSTRAINT "AdvertisingCreativeProject_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeProject" ADD CONSTRAINT "AdvertisingCreativeProject_campaignPlanId_fkey" FOREIGN KEY ("campaignPlanId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeProject" ADD CONSTRAINT "AdvertisingCreativeProject_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeProject" ADD CONSTRAINT "AdvertisingCreativeProject_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeConcept" ADD CONSTRAINT "AdvertisingCreativeConcept_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeConcept" ADD CONSTRAINT "AdvertisingCreativeConcept_creativeProjectId_fkey" FOREIGN KEY ("creativeProjectId") REFERENCES "AdvertisingCreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeVariant" ADD CONSTRAINT "AdvertisingCreativeVariant_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeVariant" ADD CONSTRAINT "AdvertisingCreativeVariant_creativeProjectId_fkey" FOREIGN KEY ("creativeProjectId") REFERENCES "AdvertisingCreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeVariant" ADD CONSTRAINT "AdvertisingCreativeVariant_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "AdvertisingCreativeConcept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeCopy" ADD CONSTRAINT "AdvertisingCreativeCopy_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeCopy" ADD CONSTRAINT "AdvertisingCreativeCopy_creativeProjectId_fkey" FOREIGN KEY ("creativeProjectId") REFERENCES "AdvertisingCreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeCopy" ADD CONSTRAINT "AdvertisingCreativeCopy_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "AdvertisingCreativeVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeAsset" ADD CONSTRAINT "AdvertisingCreativeAsset_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeAsset" ADD CONSTRAINT "AdvertisingCreativeAsset_creativeProjectId_fkey" FOREIGN KEY ("creativeProjectId") REFERENCES "AdvertisingCreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeAsset" ADD CONSTRAINT "AdvertisingCreativeAsset_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "AdvertisingCreativeVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeAsset" ADD CONSTRAINT "AdvertisingCreativeAsset_marketingAssetId_fkey" FOREIGN KEY ("marketingAssetId") REFERENCES "MarketingAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeAsset" ADD CONSTRAINT "AdvertisingCreativeAsset_visualProjectId_fkey" FOREIGN KEY ("visualProjectId") REFERENCES "VisualProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeFormat" ADD CONSTRAINT "AdvertisingCreativeFormat_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeFormat" ADD CONSTRAINT "AdvertisingCreativeFormat_creativeProjectId_fkey" FOREIGN KEY ("creativeProjectId") REFERENCES "AdvertisingCreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeReview" ADD CONSTRAINT "AdvertisingCreativeReview_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeReview" ADD CONSTRAINT "AdvertisingCreativeReview_creativeProjectId_fkey" FOREIGN KEY ("creativeProjectId") REFERENCES "AdvertisingCreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeReview" ADD CONSTRAINT "AdvertisingCreativeReview_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "AdvertisingCreativeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeReview" ADD CONSTRAINT "AdvertisingCreativeReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeVersion" ADD CONSTRAINT "AdvertisingCreativeVersion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeVersion" ADD CONSTRAINT "AdvertisingCreativeVersion_creativeProjectId_fkey" FOREIGN KEY ("creativeProjectId") REFERENCES "AdvertisingCreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeVersion" ADD CONSTRAINT "AdvertisingCreativeVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeProviderValidation" ADD CONSTRAINT "AdvertisingCreativeProviderValidation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeProviderValidation" ADD CONSTRAINT "AdvertisingCreativeProviderValidation_creativeProjectId_fkey" FOREIGN KEY ("creativeProjectId") REFERENCES "AdvertisingCreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeProviderValidation" ADD CONSTRAINT "AdvertisingCreativeProviderValidation_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "AdvertisingCreativeFormat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativePerformanceLink" ADD CONSTRAINT "AdvertisingCreativePerformanceLink_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativePerformanceLink" ADD CONSTRAINT "AdvertisingCreativePerformanceLink_creativeProjectId_fkey" FOREIGN KEY ("creativeProjectId") REFERENCES "AdvertisingCreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativePerformanceLink" ADD CONSTRAINT "AdvertisingCreativePerformanceLink_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "AdvertisingCreativeVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativePerformanceLink" ADD CONSTRAINT "AdvertisingCreativePerformanceLink_marketingCreativeId_fkey" FOREIGN KEY ("marketingCreativeId") REFERENCES "MarketingCreative"("id") ON DELETE SET NULL ON UPDATE CASCADE;
