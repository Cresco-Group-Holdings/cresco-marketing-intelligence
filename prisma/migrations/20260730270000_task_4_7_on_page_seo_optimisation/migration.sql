-- Task 4.7: On-Page SEO Optimisation

CREATE TYPE "OnPageSeoAuditStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'FAILED', 'ARCHIVED');
CREATE TYPE "OnPageSeoAuditSourceType" AS ENUM ('CRAWL_SNAPSHOT', 'LONG_FORM_DRAFT', 'SEO_BRIEF', 'MANUAL_URL');
CREATE TYPE "OnPageSeoFindingCategory" AS ENUM ('TECHNICAL', 'SEMANTIC', 'KEYWORD', 'READABILITY', 'STRUCTURED_DATA', 'LINKS', 'ACCESSIBILITY');
CREATE TYPE "OnPageSeoFindingStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED', 'OVERRIDDEN');
CREATE TYPE "OnPageSeoRecommendationType" AS ENUM (
  'FIX_TECHNICAL', 'IMPROVE_TITLE', 'IMPROVE_DESCRIPTION', 'RESTRUCTURE_HEADINGS', 'ADD_SECTION',
  'REMOVE_DUPLICATION', 'ADD_INTERNAL_LINK', 'IMPROVE_CTA', 'ADD_EVIDENCE', 'UPDATE_SCHEMA',
  'IMPROVE_ACCESSIBILITY', 'CLARIFY_CONTENT', 'UPDATE_INFORMATION'
);
CREATE TYPE "OnPageSeoRecommendationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'BLOCKING');
CREATE TYPE "OnPageSeoRecommendationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'APPLIED', 'DISMISSED');
CREATE TYPE "OnPageSeoComparisonType" AS ENUM ('PREVIOUS_AUDIT', 'LIVE_VS_DRAFT', 'CRAWL_VS_DRAFT', 'RESOLVED_ISSUES');

CREATE TABLE "OnPageSeoAudit" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "sourceType" "OnPageSeoAuditSourceType" NOT NULL,
  "url" TEXT,
  "pageTitle" TEXT,
  "status" "OnPageSeoAuditStatus" NOT NULL DEFAULT 'DRAFT',
  "currentVersionId" TEXT,
  "crawlPageId" TEXT,
  "pageSnapshotId" TEXT,
  "longFormDocumentId" TEXT,
  "briefId" TEXT,
  "targetKeywordId" TEXT,
  "keywordGroupId" TEXT,
  "clusterId" TEXT,
  "staleSnapshotWarning" BOOLEAN NOT NULL DEFAULT false,
  "staleSnapshotNote" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "OnPageSeoAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnPageSeoAuditVersion" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "versionNumber" INT NOT NULL,
  "status" "OnPageSeoAuditStatus" NOT NULL,
  "inputSnapshot" JSONB,
  "technicalSummary" JSONB,
  "semanticSummary" JSONB,
  "keywordSummary" JSONB,
  "readabilitySnapshot" JSONB,
  "evidenceBundle" JSONB,
  "changeNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnPageSeoAuditVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnPageSeoFinding" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "versionId" TEXT,
  "category" "OnPageSeoFindingCategory" NOT NULL,
  "ruleId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "status" "OnPageSeoFindingStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "OnPageSeoRecommendationPriority" NOT NULL DEFAULT 'MEDIUM',
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnPageSeoFinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnPageSeoRecommendation" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "findingId" TEXT,
  "type" "OnPageSeoRecommendationType" NOT NULL,
  "priority" "OnPageSeoRecommendationPriority" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "status" "OnPageSeoRecommendationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnPageSeoRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnPageSeoTarget" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "targetKeywordId" TEXT,
  "keywordGroupId" TEXT,
  "clusterId" TEXT,
  "targetUrl" TEXT,
  "intent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnPageSeoTarget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnPageSeoComparison" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "comparisonType" "OnPageSeoComparisonType" NOT NULL,
  "baselineVersionId" TEXT,
  "compareVersionId" TEXT,
  "baselineSnapshotId" TEXT,
  "compareSnapshotId" TEXT,
  "diffSummary" JSONB,
  "disclaimer" TEXT NOT NULL DEFAULT 'Comparisons are advisory. Rankings improvements are not guaranteed.',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnPageSeoComparison_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnPageSeoOverride" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "findingId" TEXT,
  "recommendationId" TEXT,
  "reason" TEXT NOT NULL,
  "overriddenByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnPageSeoOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnPageSeoAuditVersion_auditId_versionNumber_key" ON "OnPageSeoAuditVersion"("auditId", "versionNumber");
CREATE INDEX "OnPageSeoAudit_organisationId_brandId_status_idx" ON "OnPageSeoAudit"("organisationId", "brandId", "status");
CREATE INDEX "OnPageSeoAudit_crawlPageId_idx" ON "OnPageSeoAudit"("crawlPageId");
CREATE INDEX "OnPageSeoAuditVersion_auditId_createdAt_idx" ON "OnPageSeoAuditVersion"("auditId", "createdAt");
CREATE INDEX "OnPageSeoFinding_auditId_status_idx" ON "OnPageSeoFinding"("auditId", "status");
CREATE INDEX "OnPageSeoFinding_auditId_category_idx" ON "OnPageSeoFinding"("auditId", "category");
CREATE INDEX "OnPageSeoRecommendation_auditId_status_idx" ON "OnPageSeoRecommendation"("auditId", "status");
CREATE INDEX "OnPageSeoRecommendation_auditId_priority_idx" ON "OnPageSeoRecommendation"("auditId", "priority");
CREATE INDEX "OnPageSeoTarget_auditId_idx" ON "OnPageSeoTarget"("auditId");
CREATE INDEX "OnPageSeoComparison_auditId_comparisonType_idx" ON "OnPageSeoComparison"("auditId", "comparisonType");
CREATE INDEX "OnPageSeoOverride_auditId_idx" ON "OnPageSeoOverride"("auditId");

ALTER TABLE "OnPageSeoAudit" ADD CONSTRAINT "OnPageSeoAudit_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoAudit" ADD CONSTRAINT "OnPageSeoAudit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoAudit" ADD CONSTRAINT "OnPageSeoAudit_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoAudit" ADD CONSTRAINT "OnPageSeoAudit_crawlPageId_fkey" FOREIGN KEY ("crawlPageId") REFERENCES "SeoCrawlPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoAudit" ADD CONSTRAINT "OnPageSeoAudit_pageSnapshotId_fkey" FOREIGN KEY ("pageSnapshotId") REFERENCES "SeoPageSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoAudit" ADD CONSTRAINT "OnPageSeoAudit_longFormDocumentId_fkey" FOREIGN KEY ("longFormDocumentId") REFERENCES "LongFormContentDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoAudit" ADD CONSTRAINT "OnPageSeoAudit_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "SeoContentBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoAudit" ADD CONSTRAINT "OnPageSeoAudit_targetKeywordId_fkey" FOREIGN KEY ("targetKeywordId") REFERENCES "SeoKeyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoAudit" ADD CONSTRAINT "OnPageSeoAudit_keywordGroupId_fkey" FOREIGN KEY ("keywordGroupId") REFERENCES "SeoKeywordGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoAudit" ADD CONSTRAINT "OnPageSeoAudit_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "SeoTopicCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoAudit" ADD CONSTRAINT "OnPageSeoAudit_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OnPageSeoAuditVersion" ADD CONSTRAINT "OnPageSeoAuditVersion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoAuditVersion" ADD CONSTRAINT "OnPageSeoAuditVersion_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "OnPageSeoAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OnPageSeoFinding" ADD CONSTRAINT "OnPageSeoFinding_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoFinding" ADD CONSTRAINT "OnPageSeoFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "OnPageSeoAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoFinding" ADD CONSTRAINT "OnPageSeoFinding_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "OnPageSeoAuditVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OnPageSeoRecommendation" ADD CONSTRAINT "OnPageSeoRecommendation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoRecommendation" ADD CONSTRAINT "OnPageSeoRecommendation_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "OnPageSeoAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoRecommendation" ADD CONSTRAINT "OnPageSeoRecommendation_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "OnPageSeoFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OnPageSeoTarget" ADD CONSTRAINT "OnPageSeoTarget_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoTarget" ADD CONSTRAINT "OnPageSeoTarget_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "OnPageSeoAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoTarget" ADD CONSTRAINT "OnPageSeoTarget_targetKeywordId_fkey" FOREIGN KEY ("targetKeywordId") REFERENCES "SeoKeyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoTarget" ADD CONSTRAINT "OnPageSeoTarget_keywordGroupId_fkey" FOREIGN KEY ("keywordGroupId") REFERENCES "SeoKeywordGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoTarget" ADD CONSTRAINT "OnPageSeoTarget_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "SeoTopicCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OnPageSeoComparison" ADD CONSTRAINT "OnPageSeoComparison_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoComparison" ADD CONSTRAINT "OnPageSeoComparison_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "OnPageSeoAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoComparison" ADD CONSTRAINT "OnPageSeoComparison_baselineVersionId_fkey" FOREIGN KEY ("baselineVersionId") REFERENCES "OnPageSeoAuditVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoComparison" ADD CONSTRAINT "OnPageSeoComparison_compareVersionId_fkey" FOREIGN KEY ("compareVersionId") REFERENCES "OnPageSeoAuditVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OnPageSeoOverride" ADD CONSTRAINT "OnPageSeoOverride_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoOverride" ADD CONSTRAINT "OnPageSeoOverride_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "OnPageSeoAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoOverride" ADD CONSTRAINT "OnPageSeoOverride_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "OnPageSeoFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoOverride" ADD CONSTRAINT "OnPageSeoOverride_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "OnPageSeoRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnPageSeoOverride" ADD CONSTRAINT "OnPageSeoOverride_overriddenByUserId_fkey" FOREIGN KEY ("overriddenByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
