-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('TEXT_POST', 'IMAGE_POST', 'CAROUSEL', 'SHORT_VIDEO', 'LONG_VIDEO', 'STORY', 'ARTICLE_LINK', 'POLL', 'THREAD');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('IDEA', 'DRAFT', 'AI_GENERATED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'PARTIALLY_PUBLISHED', 'FAILED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContentPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ContentRevisionSource" AS ENUM ('USER', 'AI', 'IMPORT', 'PLATFORM_ADAPTATION', 'COMPLIANCE_FIX');

-- CreateEnum
CREATE TYPE "ContentApprovalMode" AS ENUM ('NO_APPROVAL_REQUIRED', 'ONE_APPROVER', 'TWO_APPROVERS', 'COMPLIANCE_APPROVAL_REQUIRED');

-- CreateEnum
CREATE TYPE "ContentApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContentCommentStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ContentComplianceCheckType" AS ENUM ('MISSING_DISCLAIMER', 'PROHIBITED_CLAIM', 'MISSING_DESTINATION_URL', 'MISSING_ALT_TEXT', 'UNAPPROVED_ASSET', 'EXPIRED_ASSET_LICENCE', 'UNSUPPORTED_PLATFORM_FORMAT', 'EXCESSIVE_TEXT_LENGTH', 'UNAPPROVED_MUSIC', 'MISSING_CONSENT');

-- CreateEnum
CREATE TYPE "ContentComplianceResult" AS ENUM ('PASS', 'FAIL', 'WARNING');

-- CreateTable
CREATE TABLE "OrganisationContentSettings" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "approvalMode" "ContentApprovalMode" NOT NULL DEFAULT 'ONE_APPROVER',
    "separationOfDutiesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganisationContentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objectiveId" TEXT,
    "campaignName" TEXT,
    "contentPillar" TEXT,
    "contentType" "ContentType" NOT NULL,
    "primaryMessage" TEXT,
    "targetAudienceId" TEXT,
    "primaryCTA" TEXT,
    "destinationUrl" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'IDEA',
    "priority" "ContentPriority" NOT NULL DEFAULT 'NORMAL',
    "ownerUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentVariant" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "socialAccountId" TEXT,
    "format" "ContentType" NOT NULL,
    "caption" TEXT,
    "headline" TEXT,
    "description" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "destinationUrl" TEXT,
    "firstComment" TEXT,
    "altText" TEXT,
    "thumbnailAssetId" TEXT,
    "durationSeconds" INTEGER,
    "aspectRatio" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "validationErrors" JSONB,
    "providerMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAsset" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "marketingAssetId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentRevision" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "changedFields" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "editorUserId" TEXT NOT NULL,
    "source" "ContentRevisionSource" NOT NULL DEFAULT 'USER',
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentApproval" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "approvalMode" "ContentApprovalMode" NOT NULL,
    "decision" "ContentApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT NOT NULL,
    "approverUserId" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentComment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "contentVariantId" TEXT,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ContentCommentStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentProvenance" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "createdManually" BOOLEAN NOT NULL DEFAULT true,
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "promptTemplateVersionId" TEXT,
    "sourceAssetIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceDocumentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "musicLicence" TEXT,
    "imageLicence" TEXT,
    "voiceConsent" BOOLEAN NOT NULL DEFAULT false,
    "faceConsent" BOOLEAN NOT NULL DEFAULT false,
    "commercialUsePermission" BOOLEAN NOT NULL DEFAULT false,
    "requiredAttribution" TEXT,
    "generatedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentProvenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentComplianceCheck" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "contentVariantId" TEXT,
    "checkType" "ContentComplianceCheckType" NOT NULL,
    "result" "ContentComplianceResult" NOT NULL,
    "message" TEXT NOT NULL,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "ContentComplianceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentStatusHistory" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "fromStatus" "ContentStatus",
    "toStatus" "ContentStatus" NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationContentSettings_organisationId_key" ON "OrganisationContentSettings"("organisationId");

-- CreateIndex
CREATE INDEX "ContentItem_organisationId_idx" ON "ContentItem"("organisationId");

-- CreateIndex
CREATE INDEX "ContentItem_projectId_idx" ON "ContentItem"("projectId");

-- CreateIndex
CREATE INDEX "ContentItem_brandId_idx" ON "ContentItem"("brandId");

-- CreateIndex
CREATE INDEX "ContentItem_status_idx" ON "ContentItem"("status");

-- CreateIndex
CREATE INDEX "ContentItem_ownerUserId_idx" ON "ContentItem"("ownerUserId");

-- CreateIndex
CREATE INDEX "ContentItem_createdByUserId_idx" ON "ContentItem"("createdByUserId");

-- CreateIndex
CREATE INDEX "ContentItem_archivedAt_idx" ON "ContentItem"("archivedAt");

-- CreateIndex
CREATE INDEX "ContentItem_createdAt_idx" ON "ContentItem"("createdAt");

-- CreateIndex
CREATE INDEX "ContentVariant_organisationId_idx" ON "ContentVariant"("organisationId");

-- CreateIndex
CREATE INDEX "ContentVariant_projectId_idx" ON "ContentVariant"("projectId");

-- CreateIndex
CREATE INDEX "ContentVariant_brandId_idx" ON "ContentVariant"("brandId");

-- CreateIndex
CREATE INDEX "ContentVariant_contentItemId_idx" ON "ContentVariant"("contentItemId");

-- CreateIndex
CREATE INDEX "ContentVariant_provider_idx" ON "ContentVariant"("provider");

-- CreateIndex
CREATE INDEX "ContentVariant_status_idx" ON "ContentVariant"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ContentAsset_contentItemId_marketingAssetId_key" ON "ContentAsset"("contentItemId", "marketingAssetId");

-- CreateIndex
CREATE INDEX "ContentAsset_organisationId_idx" ON "ContentAsset"("organisationId");

-- CreateIndex
CREATE INDEX "ContentAsset_brandId_idx" ON "ContentAsset"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentRevision_contentItemId_revisionNumber_key" ON "ContentRevision"("contentItemId", "revisionNumber");

-- CreateIndex
CREATE INDEX "ContentRevision_organisationId_idx" ON "ContentRevision"("organisationId");

-- CreateIndex
CREATE INDEX "ContentRevision_contentItemId_idx" ON "ContentRevision"("contentItemId");

-- CreateIndex
CREATE INDEX "ContentRevision_createdAt_idx" ON "ContentRevision"("createdAt");

-- CreateIndex
CREATE INDEX "ContentApproval_organisationId_idx" ON "ContentApproval"("organisationId");

-- CreateIndex
CREATE INDEX "ContentApproval_contentItemId_idx" ON "ContentApproval"("contentItemId");

-- CreateIndex
CREATE INDEX "ContentApproval_decision_idx" ON "ContentApproval"("decision");

-- CreateIndex
CREATE INDEX "ContentComment_organisationId_idx" ON "ContentComment"("organisationId");

-- CreateIndex
CREATE INDEX "ContentComment_contentItemId_idx" ON "ContentComment"("contentItemId");

-- CreateIndex
CREATE INDEX "ContentComment_contentVariantId_idx" ON "ContentComment"("contentVariantId");

-- CreateIndex
CREATE INDEX "ContentComment_status_idx" ON "ContentComment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ContentProvenance_contentItemId_key" ON "ContentProvenance"("contentItemId");

-- CreateIndex
CREATE INDEX "ContentProvenance_organisationId_idx" ON "ContentProvenance"("organisationId");

-- CreateIndex
CREATE INDEX "ContentProvenance_brandId_idx" ON "ContentProvenance"("brandId");

-- CreateIndex
CREATE INDEX "ContentComplianceCheck_organisationId_idx" ON "ContentComplianceCheck"("organisationId");

-- CreateIndex
CREATE INDEX "ContentComplianceCheck_contentItemId_idx" ON "ContentComplianceCheck"("contentItemId");

-- CreateIndex
CREATE INDEX "ContentComplianceCheck_checkType_idx" ON "ContentComplianceCheck"("checkType");

-- CreateIndex
CREATE INDEX "ContentComplianceCheck_result_idx" ON "ContentComplianceCheck"("result");

-- CreateIndex
CREATE INDEX "ContentStatusHistory_organisationId_idx" ON "ContentStatusHistory"("organisationId");

-- CreateIndex
CREATE INDEX "ContentStatusHistory_contentItemId_idx" ON "ContentStatusHistory"("contentItemId");

-- CreateIndex
CREATE INDEX "ContentStatusHistory_createdAt_idx" ON "ContentStatusHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "OrganisationContentSettings" ADD CONSTRAINT "OrganisationContentSettings_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "MarketingObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_targetAudienceId_fkey" FOREIGN KEY ("targetAudienceId") REFERENCES "BrandAudience"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVariant" ADD CONSTRAINT "ContentVariant_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVariant" ADD CONSTRAINT "ContentVariant_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVariant" ADD CONSTRAINT "ContentVariant_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVariant" ADD CONSTRAINT "ContentVariant_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVariant" ADD CONSTRAINT "ContentVariant_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVariant" ADD CONSTRAINT "ContentVariant_thumbnailAssetId_fkey" FOREIGN KEY ("thumbnailAssetId") REFERENCES "MarketingAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAsset" ADD CONSTRAINT "ContentAsset_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAsset" ADD CONSTRAINT "ContentAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAsset" ADD CONSTRAINT "ContentAsset_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAsset" ADD CONSTRAINT "ContentAsset_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAsset" ADD CONSTRAINT "ContentAsset_marketingAssetId_fkey" FOREIGN KEY ("marketingAssetId") REFERENCES "MarketingAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_editorUserId_fkey" FOREIGN KEY ("editorUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentApproval" ADD CONSTRAINT "ContentApproval_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentApproval" ADD CONSTRAINT "ContentApproval_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentApproval" ADD CONSTRAINT "ContentApproval_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentApproval" ADD CONSTRAINT "ContentApproval_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentApproval" ADD CONSTRAINT "ContentApproval_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentApproval" ADD CONSTRAINT "ContentApproval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentComment" ADD CONSTRAINT "ContentComment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentComment" ADD CONSTRAINT "ContentComment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentComment" ADD CONSTRAINT "ContentComment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentComment" ADD CONSTRAINT "ContentComment_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentComment" ADD CONSTRAINT "ContentComment_contentVariantId_fkey" FOREIGN KEY ("contentVariantId") REFERENCES "ContentVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentComment" ADD CONSTRAINT "ContentComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentComment" ADD CONSTRAINT "ContentComment_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentProvenance" ADD CONSTRAINT "ContentProvenance_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentProvenance" ADD CONSTRAINT "ContentProvenance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentProvenance" ADD CONSTRAINT "ContentProvenance_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentProvenance" ADD CONSTRAINT "ContentProvenance_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentComplianceCheck" ADD CONSTRAINT "ContentComplianceCheck_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentComplianceCheck" ADD CONSTRAINT "ContentComplianceCheck_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentComplianceCheck" ADD CONSTRAINT "ContentComplianceCheck_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentComplianceCheck" ADD CONSTRAINT "ContentComplianceCheck_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentComplianceCheck" ADD CONSTRAINT "ContentComplianceCheck_contentVariantId_fkey" FOREIGN KEY ("contentVariantId") REFERENCES "ContentVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentStatusHistory" ADD CONSTRAINT "ContentStatusHistory_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentStatusHistory" ADD CONSTRAINT "ContentStatusHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentStatusHistory" ADD CONSTRAINT "ContentStatusHistory_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentStatusHistory" ADD CONSTRAINT "ContentStatusHistory_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentStatusHistory" ADD CONSTRAINT "ContentStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
