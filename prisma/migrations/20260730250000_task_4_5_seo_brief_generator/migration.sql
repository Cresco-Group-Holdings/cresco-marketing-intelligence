-- Task 4.5: AI SEO content brief generator

CREATE TYPE "SeoContentBriefStatus" AS ENUM (
  'DRAFT', 'GENERATED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SUPERSEDED', 'ARCHIVED'
);
CREATE TYPE "SeoBriefKeywordRole" AS ENUM ('PRIMARY', 'SECONDARY');
CREATE TYPE "SeoBriefApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED');
CREATE TYPE "SeoBriefCommentStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TABLE "SeoContentBrief" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "workingTitle" TEXT,
  "contentType" "SeoContentFormatType",
  "status" "SeoContentBriefStatus" NOT NULL DEFAULT 'DRAFT',
  "currentVersionId" TEXT,
  "primaryKeywordId" TEXT,
  "clusterId" TEXT,
  "targetPageId" TEXT,
  "contentItemId" TEXT,
  "audience" TEXT,
  "offer" TEXT,
  "cta" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "SeoContentBrief_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoContentBriefVersion" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "briefId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "SeoContentBriefStatus" NOT NULL,
  "structuredOutput" JSONB NOT NULL,
  "evidenceSummary" JSONB,
  "limitations" TEXT,
  "aiRequestId" TEXT,
  "aiModel" TEXT,
  "aiProvider" TEXT,
  "changeNote" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoContentBriefVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoBriefKeyword" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "briefId" TEXT NOT NULL,
  "keywordId" TEXT,
  "keyword" TEXT NOT NULL,
  "role" "SeoBriefKeywordRole" NOT NULL,
  "intent" "SeoKeywordIntentType",
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoBriefKeyword_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoBriefQuestion" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "briefId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "isFaq" BOOLEAN NOT NULL DEFAULT false,
  "evidence" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoBriefQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoBriefHeading" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "briefId" TEXT NOT NULL,
  "level" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoBriefHeading_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoBriefCompetitorEvidence" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "briefId" TEXT NOT NULL,
  "competitorId" TEXT,
  "competitorUrl" TEXT,
  "evidenceType" TEXT NOT NULL,
  "excerpt" TEXT,
  "coverageNote" TEXT,
  "gapNote" TEXT,
  "observedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoBriefCompetitorEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoBriefInternalLink" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "briefId" TEXT NOT NULL,
  "sourcePageId" TEXT,
  "destinationPageId" TEXT,
  "sourceUrl" TEXT,
  "destinationUrl" TEXT,
  "suggestedAnchorConcept" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoBriefInternalLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoBriefSchemaSuggestion" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "briefId" TEXT NOT NULL,
  "schemaType" TEXT NOT NULL,
  "rationale" TEXT,
  "eligibilityNote" TEXT,
  "properties" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoBriefSchemaSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoBriefCitationRequirement" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "briefId" TEXT NOT NULL,
  "requirement" TEXT NOT NULL,
  "sourceType" TEXT,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoBriefCitationRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoBriefApproval" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "briefId" TEXT NOT NULL,
  "versionId" TEXT,
  "decision" "SeoBriefApprovalDecision" NOT NULL DEFAULT 'PENDING',
  "requestedByUserId" TEXT NOT NULL,
  "approverUserId" TEXT,
  "decisionNote" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoBriefApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoBriefComment" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "briefId" TEXT NOT NULL,
  "versionId" TEXT,
  "authorUserId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "SeoBriefCommentStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoBriefComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SeoContentBrief_organisationId_brandId_status_idx" ON "SeoContentBrief"("organisationId", "brandId", "status");
CREATE INDEX "SeoContentBrief_clusterId_idx" ON "SeoContentBrief"("clusterId");
CREATE UNIQUE INDEX "SeoContentBriefVersion_briefId_versionNumber_key" ON "SeoContentBriefVersion"("briefId", "versionNumber");
CREATE INDEX "SeoContentBriefVersion_briefId_createdAt_idx" ON "SeoContentBriefVersion"("briefId", "createdAt");
CREATE INDEX "SeoBriefKeyword_briefId_idx" ON "SeoBriefKeyword"("briefId");
CREATE INDEX "SeoBriefQuestion_briefId_idx" ON "SeoBriefQuestion"("briefId");
CREATE INDEX "SeoBriefHeading_briefId_sortOrder_idx" ON "SeoBriefHeading"("briefId", "sortOrder");
CREATE INDEX "SeoBriefCompetitorEvidence_briefId_idx" ON "SeoBriefCompetitorEvidence"("briefId");
CREATE INDEX "SeoBriefInternalLink_briefId_idx" ON "SeoBriefInternalLink"("briefId");
CREATE INDEX "SeoBriefSchemaSuggestion_briefId_idx" ON "SeoBriefSchemaSuggestion"("briefId");
CREATE INDEX "SeoBriefCitationRequirement_briefId_idx" ON "SeoBriefCitationRequirement"("briefId");
CREATE INDEX "SeoBriefApproval_briefId_decision_idx" ON "SeoBriefApproval"("briefId", "decision");
CREATE INDEX "SeoBriefComment_briefId_status_idx" ON "SeoBriefComment"("briefId", "status");

ALTER TABLE "SeoContentBrief" ADD CONSTRAINT "SeoContentBrief_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentBrief" ADD CONSTRAINT "SeoContentBrief_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentBrief" ADD CONSTRAINT "SeoContentBrief_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentBrief" ADD CONSTRAINT "SeoContentBrief_primaryKeywordId_fkey" FOREIGN KEY ("primaryKeywordId") REFERENCES "SeoKeyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoContentBrief" ADD CONSTRAINT "SeoContentBrief_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "SeoTopicCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoContentBrief" ADD CONSTRAINT "SeoContentBrief_targetPageId_fkey" FOREIGN KEY ("targetPageId") REFERENCES "SeoCrawlPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoContentBrief" ADD CONSTRAINT "SeoContentBrief_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoContentBrief" ADD CONSTRAINT "SeoContentBrief_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SeoContentBriefVersion" ADD CONSTRAINT "SeoContentBriefVersion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentBriefVersion" ADD CONSTRAINT "SeoContentBriefVersion_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "SeoContentBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentBriefVersion" ADD CONSTRAINT "SeoContentBriefVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SeoBriefKeyword" ADD CONSTRAINT "SeoBriefKeyword_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoBriefKeyword" ADD CONSTRAINT "SeoBriefKeyword_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "SeoContentBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoBriefKeyword" ADD CONSTRAINT "SeoBriefKeyword_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "SeoKeyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoBriefQuestion" ADD CONSTRAINT "SeoBriefQuestion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoBriefQuestion" ADD CONSTRAINT "SeoBriefQuestion_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "SeoContentBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoBriefHeading" ADD CONSTRAINT "SeoBriefHeading_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoBriefHeading" ADD CONSTRAINT "SeoBriefHeading_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "SeoContentBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoBriefCompetitorEvidence" ADD CONSTRAINT "SeoBriefCompetitorEvidence_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoBriefCompetitorEvidence" ADD CONSTRAINT "SeoBriefCompetitorEvidence_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "SeoContentBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoBriefInternalLink" ADD CONSTRAINT "SeoBriefInternalLink_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoBriefInternalLink" ADD CONSTRAINT "SeoBriefInternalLink_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "SeoContentBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoBriefInternalLink" ADD CONSTRAINT "SeoBriefInternalLink_sourcePageId_fkey" FOREIGN KEY ("sourcePageId") REFERENCES "SeoCrawlPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoBriefInternalLink" ADD CONSTRAINT "SeoBriefInternalLink_destinationPageId_fkey" FOREIGN KEY ("destinationPageId") REFERENCES "SeoCrawlPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoBriefSchemaSuggestion" ADD CONSTRAINT "SeoBriefSchemaSuggestion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoBriefSchemaSuggestion" ADD CONSTRAINT "SeoBriefSchemaSuggestion_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "SeoContentBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoBriefCitationRequirement" ADD CONSTRAINT "SeoBriefCitationRequirement_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoBriefCitationRequirement" ADD CONSTRAINT "SeoBriefCitationRequirement_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "SeoContentBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoBriefApproval" ADD CONSTRAINT "SeoBriefApproval_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoBriefApproval" ADD CONSTRAINT "SeoBriefApproval_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "SeoContentBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoBriefApproval" ADD CONSTRAINT "SeoBriefApproval_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SeoContentBriefVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoBriefApproval" ADD CONSTRAINT "SeoBriefApproval_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SeoBriefApproval" ADD CONSTRAINT "SeoBriefApproval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoBriefComment" ADD CONSTRAINT "SeoBriefComment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoBriefComment" ADD CONSTRAINT "SeoBriefComment_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "SeoContentBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoBriefComment" ADD CONSTRAINT "SeoBriefComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
