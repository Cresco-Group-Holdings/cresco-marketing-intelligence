-- Task 4.6: AI Long-Form SEO Content Studio

CREATE TYPE "LongFormContentType" AS ENUM (
  'BLOG_ARTICLE', 'GUIDE', 'LANDING_PAGE', 'COMPARISON', 'CASE_STUDY',
  'FAQ', 'GLOSSARY', 'DOCUMENTATION', 'PILLAR_PAGE', 'SUPPORTING_ARTICLE'
);

CREATE TYPE "LongFormDocumentStatus" AS ENUM (
  'DRAFT', 'OUTLINE_PENDING', 'OUTLINE_CONFIRMED', 'SECTIONS_GENERATING',
  'SECTIONS_DRAFT', 'EVIDENCE_REVIEW', 'SEO_REVIEW', 'COMPLIANCE_REVIEW',
  'PENDING_APPROVAL', 'APPROVED', 'PUBLISH_READY', 'ARCHIVED'
);

CREATE TYPE "LongFormSectionBlockType" AS ENUM (
  'HEADING', 'PARAGRAPH', 'LIST', 'TABLE', 'QUOTE', 'LINK', 'IMAGE',
  'CALLOUT', 'CTA', 'FAQ', 'CITATION'
);

CREATE TYPE "LongFormClaimClassification" AS ENUM (
  'SUPPORTED', 'CITATION_REQUIRED', 'INTERNAL_SOURCE', 'EXTERNAL_SOURCE',
  'OPINION', 'MARKETING_STATEMENT', 'UNVERIFIABLE'
);

CREATE TYPE "LongFormReviewStage" AS ENUM (
  'OUTLINE', 'EVIDENCE', 'SEO', 'COMPLIANCE', 'FINAL'
);

CREATE TYPE "LongFormReviewDecision" AS ENUM (
  'PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED'
);

CREATE TYPE "LongFormExportFormat" AS ENUM (
  'HTML', 'MARKDOWN', 'JSON', 'CMS_PAYLOAD', 'COPY', 'HANDOFF'
);

CREATE TYPE "LongFormGenerationAction" AS ENUM (
  'OUTLINE', 'SECTION_GENERATE', 'SECTION_REGENERATE', 'SHORTEN', 'EXPAND',
  'CHANGE_TONE', 'SIMPLIFY', 'ADD_EXAMPLES', 'REQUEST_EVIDENCE', 'FULL_DOCUMENT'
);

CREATE TABLE "LongFormContentDocument" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "briefId" TEXT NOT NULL,
  "briefVersionId" TEXT,
  "contentItemId" TEXT,
  "title" TEXT,
  "contentType" "LongFormContentType" NOT NULL DEFAULT 'BLOG_ARTICLE',
  "status" "LongFormDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "currentVersionId" TEXT,
  "slug" TEXT,
  "metaDescription" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "LongFormContentDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LongFormContentVersion" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "versionNumber" INT NOT NULL,
  "status" "LongFormDocumentStatus" NOT NULL,
  "outline" JSONB,
  "seoSnapshot" JSONB,
  "complianceSnapshot" JSONB,
  "changeNote" TEXT,
  "humanEditSummary" JSONB,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LongFormContentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LongFormSection" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "versionId" TEXT,
  "sortOrder" INT NOT NULL DEFAULT 0,
  "heading" TEXT,
  "headingLevel" INT NOT NULL DEFAULT 2,
  "blockType" "LongFormSectionBlockType" NOT NULL DEFAULT 'PARAGRAPH',
  "body" TEXT NOT NULL,
  "lockedRanges" JSONB,
  "isLocked" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LongFormSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LongFormCitation" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "sectionId" TEXT,
  "label" TEXT NOT NULL,
  "url" TEXT,
  "sourceType" TEXT,
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "isFabricated" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LongFormCitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LongFormClaim" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "sectionId" TEXT,
  "citationId" TEXT,
  "claimText" TEXT NOT NULL,
  "classification" "LongFormClaimClassification" NOT NULL,
  "isSupported" BOOLEAN NOT NULL DEFAULT false,
  "requiresCitation" BOOLEAN NOT NULL DEFAULT false,
  "flagged" BOOLEAN NOT NULL DEFAULT false,
  "flagReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LongFormClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LongFormGenerationRun" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "sectionId" TEXT,
  "action" "LongFormGenerationAction" NOT NULL,
  "aiProvider" TEXT,
  "aiModel" TEXT,
  "promptTemplateVersionId" TEXT,
  "briefVersionId" TEXT,
  "generatedSectionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "inputTokens" INT,
  "outputTokens" INT,
  "estimatedCost" DOUBLE PRECISION,
  "humanEditsAfter" JSONB,
  "sourceReferences" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LongFormGenerationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LongFormReview" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "versionId" TEXT,
  "stage" "LongFormReviewStage" NOT NULL,
  "decision" "LongFormReviewDecision" NOT NULL DEFAULT 'PENDING',
  "findings" JSONB,
  "requestedByUserId" TEXT NOT NULL,
  "reviewerUserId" TEXT,
  "decisionNote" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LongFormReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LongFormExport" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "versionId" TEXT,
  "format" "LongFormExportFormat" NOT NULL,
  "payload" JSONB NOT NULL,
  "checksum" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LongFormExport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LongFormContentVersion_documentId_versionNumber_key" ON "LongFormContentVersion"("documentId", "versionNumber");
CREATE INDEX "LongFormContentDocument_organisationId_brandId_status_idx" ON "LongFormContentDocument"("organisationId", "brandId", "status");
CREATE INDEX "LongFormContentDocument_briefId_idx" ON "LongFormContentDocument"("briefId");
CREATE INDEX "LongFormContentVersion_documentId_createdAt_idx" ON "LongFormContentVersion"("documentId", "createdAt");
CREATE INDEX "LongFormSection_documentId_sortOrder_idx" ON "LongFormSection"("documentId", "sortOrder");
CREATE INDEX "LongFormSection_versionId_idx" ON "LongFormSection"("versionId");
CREATE INDEX "LongFormCitation_documentId_idx" ON "LongFormCitation"("documentId");
CREATE INDEX "LongFormCitation_sectionId_idx" ON "LongFormCitation"("sectionId");
CREATE INDEX "LongFormClaim_documentId_flagged_idx" ON "LongFormClaim"("documentId", "flagged");
CREATE INDEX "LongFormClaim_sectionId_idx" ON "LongFormClaim"("sectionId");
CREATE INDEX "LongFormGenerationRun_documentId_createdAt_idx" ON "LongFormGenerationRun"("documentId", "createdAt");
CREATE INDEX "LongFormReview_documentId_stage_decision_idx" ON "LongFormReview"("documentId", "stage", "decision");
CREATE INDEX "LongFormExport_documentId_createdAt_idx" ON "LongFormExport"("documentId", "createdAt");

ALTER TABLE "LongFormContentDocument" ADD CONSTRAINT "LongFormContentDocument_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LongFormContentDocument" ADD CONSTRAINT "LongFormContentDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LongFormContentDocument" ADD CONSTRAINT "LongFormContentDocument_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LongFormContentDocument" ADD CONSTRAINT "LongFormContentDocument_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "SeoContentBrief"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LongFormContentDocument" ADD CONSTRAINT "LongFormContentDocument_briefVersionId_fkey" FOREIGN KEY ("briefVersionId") REFERENCES "SeoContentBriefVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LongFormContentDocument" ADD CONSTRAINT "LongFormContentDocument_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LongFormContentDocument" ADD CONSTRAINT "LongFormContentDocument_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LongFormContentVersion" ADD CONSTRAINT "LongFormContentVersion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LongFormContentVersion" ADD CONSTRAINT "LongFormContentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LongFormContentDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LongFormContentVersion" ADD CONSTRAINT "LongFormContentVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LongFormSection" ADD CONSTRAINT "LongFormSection_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LongFormSection" ADD CONSTRAINT "LongFormSection_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LongFormContentDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LongFormSection" ADD CONSTRAINT "LongFormSection_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "LongFormContentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LongFormCitation" ADD CONSTRAINT "LongFormCitation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LongFormCitation" ADD CONSTRAINT "LongFormCitation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LongFormContentDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LongFormCitation" ADD CONSTRAINT "LongFormCitation_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "LongFormSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LongFormClaim" ADD CONSTRAINT "LongFormClaim_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LongFormClaim" ADD CONSTRAINT "LongFormClaim_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LongFormContentDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LongFormClaim" ADD CONSTRAINT "LongFormClaim_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "LongFormSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LongFormClaim" ADD CONSTRAINT "LongFormClaim_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "LongFormCitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LongFormGenerationRun" ADD CONSTRAINT "LongFormGenerationRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LongFormGenerationRun" ADD CONSTRAINT "LongFormGenerationRun_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LongFormContentDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LongFormReview" ADD CONSTRAINT "LongFormReview_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LongFormReview" ADD CONSTRAINT "LongFormReview_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LongFormContentDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LongFormReview" ADD CONSTRAINT "LongFormReview_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "LongFormContentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LongFormReview" ADD CONSTRAINT "LongFormReview_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LongFormReview" ADD CONSTRAINT "LongFormReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LongFormExport" ADD CONSTRAINT "LongFormExport_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LongFormExport" ADD CONSTRAINT "LongFormExport_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LongFormContentDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LongFormExport" ADD CONSTRAINT "LongFormExport_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
