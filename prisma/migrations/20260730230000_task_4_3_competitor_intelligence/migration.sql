-- Task 4.3: Competitor search intelligence

CREATE TYPE "SeoCompetitorType" AS ENUM (
  'DIRECT',
  'INDIRECT',
  'SEARCH_COMPETITOR',
  'CONTENT_COMPETITOR',
  'ASPIRATIONAL',
  'OTHER'
);

CREATE TYPE "SeoCompetitorStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TYPE "SeoCompetitorSnapshotStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'PARTIAL',
  'FAILED',
  'BLOCKED',
  'CANCELLED'
);

CREATE TYPE "SeoContentGapType" AS ENUM (
  'TOPIC_COVERAGE',
  'MISSING_PAGE',
  'WEAK_PAGE',
  'MISSING_FORMAT',
  'MISSING_FUNNEL_STAGE',
  'MISSING_FAQ_GLOSSARY'
);

CREATE TYPE "SeoContentGapStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'PLANNED', 'DISMISSED');

CREATE TYPE "SeoKeywordOverlapType" AS ENUM ('SHARED', 'BRAND_UNIQUE', 'COMPETITOR_UNIQUE');

CREATE TABLE "SeoCompetitor" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "competitorType" "SeoCompetitorType" NOT NULL DEFAULT 'DIRECT',
  "status" "SeoCompetitorStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "SeoCompetitor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoCompetitorDomain" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "competitorId" TEXT NOT NULL,
  "hostname" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoCompetitorDomain_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoCompetitorSnapshot" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "competitorId" TEXT NOT NULL,
  "status" "SeoCompetitorSnapshotStatus" NOT NULL DEFAULT 'QUEUED',
  "pagesDiscovered" INTEGER NOT NULL DEFAULT 0,
  "pagesCrawled" INTEGER NOT NULL DEFAULT 0,
  "pagesBlocked" INTEGER NOT NULL DEFAULT 0,
  "idempotencyKey" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoCompetitorSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoCompetitorPage" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "competitorId" TEXT NOT NULL,
  "snapshotId" TEXT,
  "url" TEXT NOT NULL,
  "normalisedUrl" TEXT NOT NULL,
  "statusCode" INTEGER,
  "title" TEXT,
  "description" TEXT,
  "canonicalUrl" TEXT,
  "headings" JSONB,
  "wordCount" INTEGER,
  "structuredData" JSONB,
  "internalLinkCount" INTEGER,
  "detectedTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "contentType" TEXT,
  "contentHash" TEXT,
  "ctaType" TEXT,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "previousHash" TEXT,
  "changedAt" TIMESTAMP(3),
  CONSTRAINT "SeoCompetitorPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoCompetitorKeyword" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "competitorId" TEXT NOT NULL,
  "keyword" TEXT NOT NULL,
  "normalisedKeyword" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "position" DOUBLE PRECISION,
  "rankingUrl" TEXT,
  "provider" TEXT,
  "isManual" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoCompetitorKeyword_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoKeywordOverlap" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "competitorId" TEXT NOT NULL,
  "brandKeywordId" TEXT,
  "competitorKeywordId" TEXT,
  "keyword" TEXT NOT NULL,
  "overlapType" "SeoKeywordOverlapType" NOT NULL,
  "brandPosition" DOUBLE PRECISION,
  "competitorPosition" DOUBLE PRECISION,
  "brandUrl" TEXT,
  "competitorUrl" TEXT,
  "sourceCoverage" JSONB,
  "evidence" JSONB,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoKeywordOverlap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoContentGap" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "competitorId" TEXT NOT NULL,
  "gapType" "SeoContentGapType" NOT NULL,
  "status" "SeoContentGapStatus" NOT NULL DEFAULT 'OPEN',
  "topic" TEXT,
  "keyword" TEXT,
  "title" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "recommendedAction" TEXT,
  "originalityGuidance" TEXT,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoContentGap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoCompetitorTopic" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "competitorId" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "pageCount" INTEGER NOT NULL DEFAULT 0,
  "evidence" JSONB,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoCompetitorTopic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoCompetitorComparison" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "competitorId" TEXT NOT NULL,
  "brandPageId" TEXT,
  "competitorPageId" TEXT,
  "brandUrl" TEXT,
  "competitorUrl" TEXT,
  "comparison" JSONB NOT NULL,
  "aiSummary" JSONB,
  "limitations" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoCompetitorComparison_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoCompetitorEvidence" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "snapshotId" TEXT,
  "pageId" TEXT,
  "evidenceType" TEXT NOT NULL,
  "url" TEXT,
  "excerpt" TEXT,
  "metadata" JSONB,
  "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoCompetitorEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeoCompetitor_brandId_name_key" ON "SeoCompetitor"("brandId", "name");
CREATE INDEX "SeoCompetitor_organisationId_brandId_status_idx" ON "SeoCompetitor"("organisationId", "brandId", "status");

CREATE UNIQUE INDEX "SeoCompetitorDomain_competitorId_hostname_key" ON "SeoCompetitorDomain"("competitorId", "hostname");
CREATE INDEX "SeoCompetitorDomain_hostname_idx" ON "SeoCompetitorDomain"("hostname");

CREATE UNIQUE INDEX "SeoCompetitorSnapshot_idempotencyKey_key" ON "SeoCompetitorSnapshot"("idempotencyKey");
CREATE INDEX "SeoCompetitorSnapshot_competitorId_createdAt_idx" ON "SeoCompetitorSnapshot"("competitorId", "createdAt");
CREATE INDEX "SeoCompetitorSnapshot_status_idx" ON "SeoCompetitorSnapshot"("status");

CREATE UNIQUE INDEX "SeoCompetitorPage_competitorId_normalisedUrl_key" ON "SeoCompetitorPage"("competitorId", "normalisedUrl");
CREATE INDEX "SeoCompetitorPage_competitorId_observedAt_idx" ON "SeoCompetitorPage"("competitorId", "observedAt");

CREATE UNIQUE INDEX "SeoCompetitorKeyword_competitorId_normalisedKeyword_source_observedAt_key"
  ON "SeoCompetitorKeyword"("competitorId", "normalisedKeyword", "source", "observedAt");
CREATE INDEX "SeoCompetitorKeyword_competitorId_idx" ON "SeoCompetitorKeyword"("competitorId");

CREATE INDEX "SeoKeywordOverlap_organisationId_brandId_competitorId_idx"
  ON "SeoKeywordOverlap"("organisationId", "brandId", "competitorId");
CREATE INDEX "SeoKeywordOverlap_overlapType_idx" ON "SeoKeywordOverlap"("overlapType");

CREATE INDEX "SeoContentGap_organisationId_brandId_status_idx" ON "SeoContentGap"("organisationId", "brandId", "status");
CREATE INDEX "SeoContentGap_competitorId_gapType_idx" ON "SeoContentGap"("competitorId", "gapType");

CREATE UNIQUE INDEX "SeoCompetitorTopic_competitorId_topic_key" ON "SeoCompetitorTopic"("competitorId", "topic");
CREATE INDEX "SeoCompetitorTopic_competitorId_idx" ON "SeoCompetitorTopic"("competitorId");

CREATE INDEX "SeoCompetitorComparison_organisationId_brandId_competitorId_idx"
  ON "SeoCompetitorComparison"("organisationId", "brandId", "competitorId");

CREATE INDEX "SeoCompetitorEvidence_snapshotId_idx" ON "SeoCompetitorEvidence"("snapshotId");
CREATE INDEX "SeoCompetitorEvidence_pageId_idx" ON "SeoCompetitorEvidence"("pageId");

ALTER TABLE "SeoCompetitor" ADD CONSTRAINT "SeoCompetitor_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCompetitor" ADD CONSTRAINT "SeoCompetitor_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCompetitor" ADD CONSTRAINT "SeoCompetitor_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoCompetitorDomain" ADD CONSTRAINT "SeoCompetitorDomain_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCompetitorDomain" ADD CONSTRAINT "SeoCompetitorDomain_competitorId_fkey"
  FOREIGN KEY ("competitorId") REFERENCES "SeoCompetitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoCompetitorSnapshot" ADD CONSTRAINT "SeoCompetitorSnapshot_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCompetitorSnapshot" ADD CONSTRAINT "SeoCompetitorSnapshot_competitorId_fkey"
  FOREIGN KEY ("competitorId") REFERENCES "SeoCompetitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoCompetitorPage" ADD CONSTRAINT "SeoCompetitorPage_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCompetitorPage" ADD CONSTRAINT "SeoCompetitorPage_competitorId_fkey"
  FOREIGN KEY ("competitorId") REFERENCES "SeoCompetitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCompetitorPage" ADD CONSTRAINT "SeoCompetitorPage_snapshotId_fkey"
  FOREIGN KEY ("snapshotId") REFERENCES "SeoCompetitorSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoCompetitorKeyword" ADD CONSTRAINT "SeoCompetitorKeyword_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCompetitorKeyword" ADD CONSTRAINT "SeoCompetitorKeyword_competitorId_fkey"
  FOREIGN KEY ("competitorId") REFERENCES "SeoCompetitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoKeywordOverlap" ADD CONSTRAINT "SeoKeywordOverlap_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordOverlap" ADD CONSTRAINT "SeoKeywordOverlap_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordOverlap" ADD CONSTRAINT "SeoKeywordOverlap_competitorId_fkey"
  FOREIGN KEY ("competitorId") REFERENCES "SeoCompetitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordOverlap" ADD CONSTRAINT "SeoKeywordOverlap_brandKeywordId_fkey"
  FOREIGN KEY ("brandKeywordId") REFERENCES "SeoKeyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordOverlap" ADD CONSTRAINT "SeoKeywordOverlap_competitorKeywordId_fkey"
  FOREIGN KEY ("competitorKeywordId") REFERENCES "SeoCompetitorKeyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoContentGap" ADD CONSTRAINT "SeoContentGap_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentGap" ADD CONSTRAINT "SeoContentGap_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentGap" ADD CONSTRAINT "SeoContentGap_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentGap" ADD CONSTRAINT "SeoContentGap_competitorId_fkey"
  FOREIGN KEY ("competitorId") REFERENCES "SeoCompetitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoCompetitorTopic" ADD CONSTRAINT "SeoCompetitorTopic_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCompetitorTopic" ADD CONSTRAINT "SeoCompetitorTopic_competitorId_fkey"
  FOREIGN KEY ("competitorId") REFERENCES "SeoCompetitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoCompetitorComparison" ADD CONSTRAINT "SeoCompetitorComparison_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCompetitorComparison" ADD CONSTRAINT "SeoCompetitorComparison_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCompetitorComparison" ADD CONSTRAINT "SeoCompetitorComparison_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCompetitorComparison" ADD CONSTRAINT "SeoCompetitorComparison_competitorId_fkey"
  FOREIGN KEY ("competitorId") REFERENCES "SeoCompetitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCompetitorComparison" ADD CONSTRAINT "SeoCompetitorComparison_brandPageId_fkey"
  FOREIGN KEY ("brandPageId") REFERENCES "SeoCrawlPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoCompetitorComparison" ADD CONSTRAINT "SeoCompetitorComparison_competitorPageId_fkey"
  FOREIGN KEY ("competitorPageId") REFERENCES "SeoCompetitorPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoCompetitorEvidence" ADD CONSTRAINT "SeoCompetitorEvidence_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCompetitorEvidence" ADD CONSTRAINT "SeoCompetitorEvidence_snapshotId_fkey"
  FOREIGN KEY ("snapshotId") REFERENCES "SeoCompetitorSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoCompetitorEvidence" ADD CONSTRAINT "SeoCompetitorEvidence_pageId_fkey"
  FOREIGN KEY ("pageId") REFERENCES "SeoCompetitorPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
