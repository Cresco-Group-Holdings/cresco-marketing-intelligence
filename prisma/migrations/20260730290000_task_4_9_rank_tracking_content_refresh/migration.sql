-- Task 4.9: Rank tracking & content refresh intelligence

CREATE TYPE "SeoRankTrackingProjectStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "SeoRankDataSource" AS ENUM ('SEARCH_CONSOLE', 'RANK_PROVIDER', 'MANUAL_IMPORT', 'COMPLIANT_SERP');
CREATE TYPE "SeoTrackedKeywordStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "SeoRankTrackingSchedule" AS ENUM ('DAILY', 'WEEKLY', 'MANUAL');
CREATE TYPE "SeoRankDevice" AS ENUM ('DESKTOP', 'MOBILE', 'TABLET', 'ALL');
CREATE TYPE "SeoRankResultType" AS ENUM ('ORGANIC', 'FEATURED_SNIPPET', 'LOCAL_PACK', 'IMAGE', 'VIDEO', 'NEWS', 'OTHER');
CREATE TYPE "SeoRankChangeType" AS ENUM ('POSITION_GAIN', 'POSITION_LOSS', 'TOP_3_ENTRY', 'TOP_10_ENTRY', 'TOP_20_ENTRY', 'RANGE_LOSS', 'URL_SWITCH', 'IMPRESSION_DROP', 'CLICK_DECLINE', 'SERP_FEATURE_CHANGE', 'UNSTABLE_RANKING', 'MISSING_OBSERVATION', 'PROVIDER_SYNC_FAILURE');
CREATE TYPE "SeoContentRefreshCandidateStatus" AS ENUM ('PENDING', 'REVIEWING', 'APPROVED', 'DISMISSED', 'CONVERTED');
CREATE TYPE "SeoContentRefreshRecommendationType" AS ENUM ('UPDATE_FACTS', 'UPDATE_STATISTICS', 'EXPAND_SECTION', 'IMPROVE_TITLE', 'IMPROVE_DESCRIPTION', 'ADD_FAQ', 'ADD_INTERNAL_LINKS', 'CONSOLIDATE_CONTENT', 'FIX_TECHNICAL', 'REWRITE_INTRODUCTION', 'IMPROVE_CTA', 'REVIEW_SEARCH_INTENT', 'RETIRE_CONTENT');
CREATE TYPE "SeoContentRefreshRecommendationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CONVERTED');
CREATE TYPE "SeoContentRefreshWorkflowType" AS ENUM ('SEO_BRIEF', 'CONTENT_TASK', 'LONG_FORM_REVISION', 'EXPERIMENT', 'INTERNAL_LINK_PROPOSAL', 'TECHNICAL_FIX');
CREATE TYPE "SeoContentRefreshOutcomeStatus" AS ENUM ('CREATED', 'IN_PROGRESS', 'IMPLEMENTED', 'MEASURED', 'CLOSED');

CREATE TABLE "SeoRankTrackingProject" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "seoSiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SeoRankTrackingProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "keywordQuota" INTEGER NOT NULL DEFAULT 100,
    "keywordCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncSource" "SeoRankDataSource",
    "lastSyncStatus" TEXT,
    "alertSettings" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SeoRankTrackingProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoTrackedKeyword" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "trackingProjectId" TEXT NOT NULL,
    "keywordId" TEXT,
    "keyword" TEXT NOT NULL,
    "targetPageId" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "language" TEXT NOT NULL DEFAULT 'en',
    "device" "SeoRankDevice" NOT NULL DEFAULT 'ALL',
    "schedule" "SeoRankTrackingSchedule" NOT NULL DEFAULT 'WEEKLY',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SeoTrackedKeywordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SeoTrackedKeyword_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoRankingUrl" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "trackedKeywordId" TEXT NOT NULL,
    "crawlPageId" TEXT,
    "url" TEXT NOT NULL,
    "isTarget" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeoRankingUrl_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoRankObservation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "trackedKeywordId" TEXT NOT NULL,
    "source" "SeoRankDataSource" NOT NULL,
    "keyword" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "device" "SeoRankDevice" NOT NULL,
    "observedDate" DATE NOT NULL,
    "rank" INTEGER,
    "resultType" "SeoRankResultType" NOT NULL DEFAULT 'ORGANIC',
    "rankingUrlId" TEXT,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "ctr" DOUBLE PRECISION,
    "providerMetadata" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeoRankObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoSerpObservation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "trackedKeywordId" TEXT NOT NULL,
    "observationId" TEXT,
    "featureType" TEXT NOT NULL,
    "position" INTEGER,
    "observedDate" DATE NOT NULL,
    "providerMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeoSerpObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoRankChange" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "trackingProjectId" TEXT NOT NULL,
    "trackedKeywordId" TEXT NOT NULL,
    "changeType" "SeoRankChangeType" NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "previousRank" INTEGER,
    "currentRank" INTEGER,
    "previousUrl" TEXT,
    "currentUrl" TEXT,
    "evidence" JSONB NOT NULL,
    "isAlert" BOOLEAN NOT NULL DEFAULT false,
    "alertSentAt" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeoRankChange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoContentRefreshCandidate" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "trackingProjectId" TEXT,
    "crawlPageId" TEXT,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "decayScore" DOUBLE PRECISION NOT NULL,
    "signals" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "dateRangeStart" DATE NOT NULL,
    "dateRangeEnd" DATE NOT NULL,
    "status" "SeoContentRefreshCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SeoContentRefreshCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoContentRefreshRecommendation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "recommendationType" "SeoContentRefreshRecommendationType" NOT NULL,
    "evidence" JSONB NOT NULL,
    "dateRangeStart" DATE NOT NULL,
    "dateRangeEnd" DATE NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "expectedHypothesis" TEXT NOT NULL,
    "measurementPlan" TEXT NOT NULL,
    "status" "SeoContentRefreshRecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SeoContentRefreshRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoContentRefreshOutcome" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "recommendationId" TEXT,
    "workflowType" "SeoContentRefreshWorkflowType" NOT NULL,
    "workflowRefId" TEXT,
    "status" "SeoContentRefreshOutcomeStatus" NOT NULL DEFAULT 'CREATED',
    "outcomeData" JSONB,
    "implementedAt" TIMESTAMP(3),
    "measuredAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SeoContentRefreshOutcome_pkey" PRIMARY KEY ("id")
);

-- Indexes and foreign keys
CREATE UNIQUE INDEX "SeoTrackedKeyword_trackingProjectId_keyword_country_language_device_key" ON "SeoTrackedKeyword"("trackingProjectId", "keyword", "country", "language", "device");
CREATE UNIQUE INDEX "SeoRankingUrl_trackedKeywordId_url_key" ON "SeoRankingUrl"("trackedKeywordId", "url");
CREATE UNIQUE INDEX "SeoRankObservation_trackedKeywordId_source_observedDate_device_resultType_key" ON "SeoRankObservation"("trackedKeywordId", "source", "observedDate", "device", "resultType");

ALTER TABLE "SeoRankTrackingProject" ADD CONSTRAINT "SeoRankTrackingProject_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoRankTrackingProject" ADD CONSTRAINT "SeoRankTrackingProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoRankTrackingProject" ADD CONSTRAINT "SeoRankTrackingProject_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoRankTrackingProject" ADD CONSTRAINT "SeoRankTrackingProject_seoSiteId_fkey" FOREIGN KEY ("seoSiteId") REFERENCES "SeoSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoRankTrackingProject" ADD CONSTRAINT "SeoRankTrackingProject_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SeoTrackedKeyword" ADD CONSTRAINT "SeoTrackedKeyword_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoTrackedKeyword" ADD CONSTRAINT "SeoTrackedKeyword_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoTrackedKeyword" ADD CONSTRAINT "SeoTrackedKeyword_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoTrackedKeyword" ADD CONSTRAINT "SeoTrackedKeyword_trackingProjectId_fkey" FOREIGN KEY ("trackingProjectId") REFERENCES "SeoRankTrackingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoTrackedKeyword" ADD CONSTRAINT "SeoTrackedKeyword_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "SeoKeyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoTrackedKeyword" ADD CONSTRAINT "SeoTrackedKeyword_targetPageId_fkey" FOREIGN KEY ("targetPageId") REFERENCES "SeoCrawlPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoRankingUrl" ADD CONSTRAINT "SeoRankingUrl_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoRankingUrl" ADD CONSTRAINT "SeoRankingUrl_trackedKeywordId_fkey" FOREIGN KEY ("trackedKeywordId") REFERENCES "SeoTrackedKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoRankingUrl" ADD CONSTRAINT "SeoRankingUrl_crawlPageId_fkey" FOREIGN KEY ("crawlPageId") REFERENCES "SeoCrawlPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoRankObservation" ADD CONSTRAINT "SeoRankObservation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoRankObservation" ADD CONSTRAINT "SeoRankObservation_trackedKeywordId_fkey" FOREIGN KEY ("trackedKeywordId") REFERENCES "SeoTrackedKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoRankObservation" ADD CONSTRAINT "SeoRankObservation_rankingUrlId_fkey" FOREIGN KEY ("rankingUrlId") REFERENCES "SeoRankingUrl"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoSerpObservation" ADD CONSTRAINT "SeoSerpObservation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoSerpObservation" ADD CONSTRAINT "SeoSerpObservation_trackedKeywordId_fkey" FOREIGN KEY ("trackedKeywordId") REFERENCES "SeoTrackedKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoSerpObservation" ADD CONSTRAINT "SeoSerpObservation_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "SeoRankObservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoRankChange" ADD CONSTRAINT "SeoRankChange_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoRankChange" ADD CONSTRAINT "SeoRankChange_trackingProjectId_fkey" FOREIGN KEY ("trackingProjectId") REFERENCES "SeoRankTrackingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoRankChange" ADD CONSTRAINT "SeoRankChange_trackedKeywordId_fkey" FOREIGN KEY ("trackedKeywordId") REFERENCES "SeoTrackedKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoContentRefreshCandidate" ADD CONSTRAINT "SeoContentRefreshCandidate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentRefreshCandidate" ADD CONSTRAINT "SeoContentRefreshCandidate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentRefreshCandidate" ADD CONSTRAINT "SeoContentRefreshCandidate_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentRefreshCandidate" ADD CONSTRAINT "SeoContentRefreshCandidate_trackingProjectId_fkey" FOREIGN KEY ("trackingProjectId") REFERENCES "SeoRankTrackingProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoContentRefreshCandidate" ADD CONSTRAINT "SeoContentRefreshCandidate_crawlPageId_fkey" FOREIGN KEY ("crawlPageId") REFERENCES "SeoCrawlPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoContentRefreshRecommendation" ADD CONSTRAINT "SeoContentRefreshRecommendation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentRefreshRecommendation" ADD CONSTRAINT "SeoContentRefreshRecommendation_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "SeoContentRefreshCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoContentRefreshOutcome" ADD CONSTRAINT "SeoContentRefreshOutcome_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentRefreshOutcome" ADD CONSTRAINT "SeoContentRefreshOutcome_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "SeoContentRefreshCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentRefreshOutcome" ADD CONSTRAINT "SeoContentRefreshOutcome_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "SeoContentRefreshRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoContentRefreshOutcome" ADD CONSTRAINT "SeoContentRefreshOutcome_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "SeoRankTrackingProject_organisationId_brandId_status_idx" ON "SeoRankTrackingProject"("organisationId", "brandId", "status");
CREATE INDEX "SeoTrackedKeyword_organisationId_brandId_status_idx" ON "SeoTrackedKeyword"("organisationId", "brandId", "status");
CREATE INDEX "SeoRankObservation_trackedKeywordId_observedDate_idx" ON "SeoRankObservation"("trackedKeywordId", "observedDate");
CREATE INDEX "SeoRankChange_trackingProjectId_isAlert_detectedAt_idx" ON "SeoRankChange"("trackingProjectId", "isAlert", "detectedAt");
CREATE INDEX "SeoContentRefreshCandidate_organisationId_brandId_status_idx" ON "SeoContentRefreshCandidate"("organisationId", "brandId", "status");
