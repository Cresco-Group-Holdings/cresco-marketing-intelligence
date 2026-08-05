-- Content Studio Core: studio types, lifecycle statuses, versioning, reviews, templates, knowledge refs

-- CreateEnum
CREATE TYPE "ContentStudioType" AS ENUM ('SOCIAL_POST', 'AD_COPY', 'EMAIL', 'BLOG_ARTICLE', 'LANDING_PAGE', 'VIDEO_SCRIPT', 'IMAGE_BRIEF', 'PRESS_RELEASE', 'CASE_STUDY', 'SALES_COPY', 'SEO_CONTENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ContentReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "ContentKnowledgeReferenceType" AS ENUM ('AUDIENCE', 'PERSONA', 'OFFER', 'MESSAGING', 'VOICE', 'COMPLIANCE_RULE', 'REFERENCE', 'CUSTOM');

-- AlterEnum ContentStatus
ALTER TYPE "ContentStatus" ADD VALUE 'BRIEF' AFTER 'IDEA';
ALTER TYPE "ContentStatus" ADD VALUE 'READY' AFTER 'APPROVED';

-- AlterEnum ContentComplianceCheckType
ALTER TYPE "ContentComplianceCheckType" ADD VALUE 'MISSING_BRAND_CONTEXT';
ALTER TYPE "ContentComplianceCheckType" ADD VALUE 'MISSING_CTA';
ALTER TYPE "ContentComplianceCheckType" ADD VALUE 'UNSUPPORTED_STATEMENT';
ALTER TYPE "ContentComplianceCheckType" ADD VALUE 'TONE_OF_VOICE_WARNING';
ALTER TYPE "ContentComplianceCheckType" ADD VALUE 'MISSING_CAMPAIGN';
ALTER TYPE "ContentComplianceCheckType" ADD VALUE 'MISSING_CHANNEL_VARIANT';

-- AlterEnum ContentActivityType
ALTER TYPE "ContentActivityType" ADD VALUE 'VERSION_CREATED';
ALTER TYPE "ContentActivityType" ADD VALUE 'REVIEW_SUBMITTED';
ALTER TYPE "ContentActivityType" ADD VALUE 'COMPLIANCE_CHECKED';
ALTER TYPE "ContentActivityType" ADD VALUE 'TEMPLATE_APPLIED';

-- AlterTable ContentItem
ALTER TABLE "ContentItem" ADD COLUMN "studioType" "ContentStudioType",
ADD COLUMN "contentBody" TEXT,
ADD COLUMN "audienceSummary" TEXT,
ADD COLUMN "studioObjective" TEXT,
ADD COLUMN "primaryChannel" "MarketingChannel",
ADD COLUMN "dueAt" TIMESTAMP(3),
ADD COLUMN "scheduledFor" TIMESTAMP(3),
ADD COLUMN "timezone" TEXT,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "ContentItem_studioType_idx" ON "ContentItem"("studioType");
CREATE INDEX "ContentItem_scheduledFor_idx" ON "ContentItem"("scheduledFor");
CREATE INDEX "ContentItem_dueAt_idx" ON "ContentItem"("dueAt");

-- AlterTable ContentVariant
ALTER TABLE "ContentVariant" ALTER COLUMN "provider" DROP NOT NULL;
ALTER TABLE "ContentVariant" ADD COLUMN "marketingChannel" "MarketingChannel",
ADD COLUMN "channelBody" TEXT;

CREATE INDEX "ContentVariant_marketingChannel_idx" ON "ContentVariant"("marketingChannel");

-- CreateTable ContentVersion
CREATE TABLE "ContentVersion" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeSummary" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentVersion_contentItemId_versionNumber_key" ON "ContentVersion"("contentItemId", "versionNumber");
CREATE INDEX "ContentVersion_organisationId_idx" ON "ContentVersion"("organisationId");
CREATE INDEX "ContentVersion_contentItemId_idx" ON "ContentVersion"("contentItemId");
CREATE INDEX "ContentVersion_createdAt_idx" ON "ContentVersion"("createdAt");

-- CreateTable ContentReview
CREATE TABLE "ContentReview" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "reviewerUserId" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "status" "ContentReviewStatus" NOT NULL DEFAULT 'PENDING',
    "feedback" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContentReview_organisationId_idx" ON "ContentReview"("organisationId");
CREATE INDEX "ContentReview_contentItemId_idx" ON "ContentReview"("contentItemId");
CREATE INDEX "ContentReview_status_idx" ON "ContentReview"("status");
CREATE INDEX "ContentReview_reviewerUserId_idx" ON "ContentReview"("reviewerUserId");

-- CreateTable ContentTemplate
CREATE TABLE "ContentTemplate" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "studioType" "ContentStudioType" NOT NULL,
    "primaryChannel" "MarketingChannel",
    "titleTemplate" TEXT,
    "objectiveTemplate" TEXT,
    "audienceSummaryTemplate" TEXT,
    "contentBodyTemplate" TEXT,
    "callToActionTemplate" TEXT,
    "variantTemplates" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ContentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContentTemplate_organisationId_idx" ON "ContentTemplate"("organisationId");
CREATE INDEX "ContentTemplate_brandId_idx" ON "ContentTemplate"("brandId");
CREATE INDEX "ContentTemplate_studioType_idx" ON "ContentTemplate"("studioType");
CREATE INDEX "ContentTemplate_isActive_idx" ON "ContentTemplate"("isActive");
CREATE INDEX "ContentTemplate_archivedAt_idx" ON "ContentTemplate"("archivedAt");

-- CreateTable ContentKnowledgeReference
CREATE TABLE "ContentKnowledgeReference" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "referenceType" "ContentKnowledgeReferenceType" NOT NULL,
    "referenceId" TEXT,
    "label" TEXT NOT NULL,
    "excerpt" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentKnowledgeReference_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContentKnowledgeReference_organisationId_idx" ON "ContentKnowledgeReference"("organisationId");
CREATE INDEX "ContentKnowledgeReference_contentItemId_idx" ON "ContentKnowledgeReference"("contentItemId");
CREATE INDEX "ContentKnowledgeReference_referenceType_idx" ON "ContentKnowledgeReference"("referenceType");

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContentReview" ADD CONSTRAINT "ContentReview_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentReview" ADD CONSTRAINT "ContentReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentReview" ADD CONSTRAINT "ContentReview_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentReview" ADD CONSTRAINT "ContentReview_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentReview" ADD CONSTRAINT "ContentReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentReview" ADD CONSTRAINT "ContentReview_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContentTemplate" ADD CONSTRAINT "ContentTemplate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentTemplate" ADD CONSTRAINT "ContentTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentTemplate" ADD CONSTRAINT "ContentTemplate_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentTemplate" ADD CONSTRAINT "ContentTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContentKnowledgeReference" ADD CONSTRAINT "ContentKnowledgeReference_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentKnowledgeReference" ADD CONSTRAINT "ContentKnowledgeReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentKnowledgeReference" ADD CONSTRAINT "ContentKnowledgeReference_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentKnowledgeReference" ADD CONSTRAINT "ContentKnowledgeReference_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentKnowledgeReference" ADD CONSTRAINT "ContentKnowledgeReference_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
