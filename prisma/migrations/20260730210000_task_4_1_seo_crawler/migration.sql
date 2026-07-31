-- Task 4.1: Technical SEO crawler

CREATE TYPE "SeoSiteStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED', 'VERIFICATION_REQUIRED');
CREATE TYPE "SeoDomainVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');
CREATE TYPE "SeoDomainVerificationMethod" AS ENUM (
  'DNS_TXT',
  'HTML_FILE',
  'META_TAG',
  'TRACKING_PROPERTY',
  'SEARCH_CONSOLE'
);
CREATE TYPE "SeoCrawlRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');
CREATE TYPE "SeoCrawlQueueItemStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED');
CREATE TYPE "SeoLinkType" AS ENUM ('INTERNAL', 'EXTERNAL', 'ASSET', 'MAILTO', 'TELEPHONE', 'OTHER');
CREATE TYPE "SeoIssueSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "SeoIssueStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'FIXED', 'IGNORED', 'FALSE_POSITIVE', 'REOPENED');

CREATE TABLE "SeoSite" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "trackingPropertyId" TEXT,
  "name" TEXT NOT NULL,
  "primaryDomain" TEXT NOT NULL,
  "preferredProtocol" TEXT NOT NULL DEFAULT 'https',
  "defaultLocale" TEXT,
  "defaultTimezone" TEXT,
  "status" "SeoSiteStatus" NOT NULL DEFAULT 'VERIFICATION_REQUIRED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoSite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoSiteDomain" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "seoSiteId" TEXT NOT NULL,
  "hostname" TEXT NOT NULL,
  "verificationMethod" "SeoDomainVerificationMethod",
  "verificationTokenHash" TEXT,
  "verificationStatus" "SeoDomainVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "verifiedAt" TIMESTAMP(3),
  "verifiedByUserId" TEXT,
  "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoSiteDomain_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoCrawlConfiguration" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "seoSiteId" TEXT NOT NULL,
  "startUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "allowedSubdomains" BOOLEAN NOT NULL DEFAULT true,
  "includeRules" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "excludeRules" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "maxPages" INTEGER NOT NULL DEFAULT 500,
  "maxDepth" INTEGER NOT NULL DEFAULT 5,
  "requestConcurrency" INTEGER NOT NULL DEFAULT 2,
  "requestDelayMs" INTEGER NOT NULL DEFAULT 500,
  "requestTimeoutMs" INTEGER NOT NULL DEFAULT 15000,
  "redirectLimit" INTEGER NOT NULL DEFAULT 5,
  "userAgent" TEXT NOT NULL DEFAULT 'CrescoSEOBot/1.0',
  "respectRobotsTxt" BOOLEAN NOT NULL DEFAULT true,
  "followCanonical" BOOLEAN NOT NULL DEFAULT true,
  "queryParamRules" JSONB,
  "ignoredExtensions" TEXT[] DEFAULT ARRAY['.pdf', '.zip', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.css', '.js', '.woff', '.woff2']::TEXT[],
  "customHeaders" JSONB,
  "crawlSchedule" TEXT,
  "configVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoCrawlConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoCrawlRun" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "seoSiteId" TEXT NOT NULL,
  "status" "SeoCrawlRunStatus" NOT NULL DEFAULT 'QUEUED',
  "idempotencyKey" TEXT NOT NULL,
  "pagesDiscovered" INTEGER NOT NULL DEFAULT 0,
  "pagesCrawled" INTEGER NOT NULL DEFAULT 0,
  "pagesBlocked" INTEGER NOT NULL DEFAULT 0,
  "issuesFound" INTEGER NOT NULL DEFAULT 0,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "nextRetryAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "heartbeatAt" TIMESTAMP(3),
  "leaseExpiresAt" TIMESTAMP(3),
  "workerId" TEXT,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoCrawlRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoCrawlQueueItem" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "seoSiteId" TEXT NOT NULL,
  "crawlRunId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "normalisedUrl" TEXT NOT NULL,
  "depth" INTEGER NOT NULL DEFAULT 0,
  "status" "SeoCrawlQueueItemStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoCrawlQueueItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoCrawlPage" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "seoSiteId" TEXT NOT NULL,
  "normalisedUrl" TEXT NOT NULL,
  "path" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastStatusCode" INTEGER,
  "isOrphanCandidate" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "SeoCrawlPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoPageSnapshot" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "seoSiteId" TEXT NOT NULL,
  "crawlRunId" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "requestedUrl" TEXT NOT NULL,
  "finalUrl" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "contentType" TEXT,
  "responseTimeMs" INTEGER,
  "contentHash" TEXT,
  "title" TEXT,
  "description" TEXT,
  "canonicalUrl" TEXT,
  "robotsDirective" TEXT,
  "lang" TEXT,
  "wordCount" INTEGER,
  "headings" JSONB,
  "openGraph" JSONB,
  "twitterCard" JSONB,
  "redirectChain" JSONB,
  "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "parserVersion" TEXT NOT NULL DEFAULT '1.0',
  "rawReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoPageSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoCrawlLink" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "seoSiteId" TEXT NOT NULL,
  "crawlRunId" TEXT NOT NULL,
  "snapshotId" TEXT,
  "sourcePageId" TEXT NOT NULL,
  "destinationPageId" TEXT,
  "sourceUrl" TEXT NOT NULL,
  "destinationUrl" TEXT NOT NULL,
  "linkType" "SeoLinkType" NOT NULL,
  "anchorText" TEXT,
  "rel" TEXT,
  "isFollowed" BOOLEAN NOT NULL DEFAULT true,
  "isImageLink" BOOLEAN NOT NULL DEFAULT false,
  "statusCode" INTEGER,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoCrawlLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoCrawlResource" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "crawlRunId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "statusCode" INTEGER,
  "contentLength" INTEGER,
  "contentType" TEXT,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoCrawlResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoIssueDefinition" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" "SeoIssueSeverity" NOT NULL,
  "category" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "thresholds" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoIssueDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoCrawlIssue" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "seoSiteId" TEXT NOT NULL,
  "crawlRunId" TEXT NOT NULL,
  "pageId" TEXT,
  "snapshotId" TEXT,
  "ruleId" TEXT NOT NULL,
  "ruleVersion" INTEGER NOT NULL,
  "severity" "SeoIssueSeverity" NOT NULL,
  "status" "SeoIssueStatus" NOT NULL DEFAULT 'OPEN',
  "affectedUrl" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "explanation" TEXT NOT NULL,
  "recommendedAction" TEXT,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "SeoCrawlIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoIssueResolution" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "issueId" TEXT NOT NULL,
  "status" "SeoIssueStatus" NOT NULL,
  "note" TEXT,
  "resolvedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoIssueResolution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoRobotsSnapshot" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "seoSiteId" TEXT NOT NULL,
  "fetchedUrl" TEXT NOT NULL,
  "httpStatus" INTEGER NOT NULL,
  "contentHash" TEXT,
  "content" TEXT,
  "crawlDelay" INTEGER,
  "sitemapUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "applicableRules" JSONB,
  "parsingWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoRobotsSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoSitemap" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "seoSiteId" TEXT NOT NULL,
  "sitemapUrl" TEXT NOT NULL,
  "sitemapType" TEXT NOT NULL DEFAULT 'urlset',
  "httpStatus" INTEGER,
  "lastModified" TIMESTAMP(3),
  "discoveredCount" INTEGER NOT NULL DEFAULT 0,
  "parsingErrors" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "contentHash" TEXT,
  "fetchedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoSitemap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoSitemapUrl" (
  "id" TEXT NOT NULL,
  "sitemapId" TEXT NOT NULL,
  "loc" TEXT NOT NULL,
  "lastmod" TIMESTAMP(3),
  "changefreq" TEXT,
  "priority" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoSitemapUrl_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoStructuredDataItem" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "seoSiteId" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "snapshotId" TEXT,
  "schemaType" TEXT NOT NULL,
  "format" TEXT NOT NULL DEFAULT 'json-ld',
  "parsedContent" JSONB,
  "validationStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "parsingError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoStructuredDataItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeoSite_brandId_primaryDomain_key" ON "SeoSite"("brandId", "primaryDomain");
CREATE INDEX "SeoSite_organisationId_brandId_idx" ON "SeoSite"("organisationId", "brandId");
CREATE INDEX "SeoSite_status_idx" ON "SeoSite"("status");

CREATE UNIQUE INDEX "SeoSiteDomain_seoSiteId_hostname_key" ON "SeoSiteDomain"("seoSiteId", "hostname");
CREATE INDEX "SeoSiteDomain_organisationId_brandId_idx" ON "SeoSiteDomain"("organisationId", "brandId");
CREATE INDEX "SeoSiteDomain_verificationStatus_idx" ON "SeoSiteDomain"("verificationStatus");

CREATE UNIQUE INDEX "SeoCrawlConfiguration_seoSiteId_key" ON "SeoCrawlConfiguration"("seoSiteId");

CREATE UNIQUE INDEX "SeoCrawlRun_idempotencyKey_key" ON "SeoCrawlRun"("idempotencyKey");
CREATE INDEX "SeoCrawlRun_organisationId_brandId_createdAt_idx" ON "SeoCrawlRun"("organisationId", "brandId", "createdAt");
CREATE INDEX "SeoCrawlRun_seoSiteId_status_idx" ON "SeoCrawlRun"("seoSiteId", "status");
CREATE INDEX "SeoCrawlRun_status_nextRetryAt_idx" ON "SeoCrawlRun"("status", "nextRetryAt");

CREATE UNIQUE INDEX "SeoCrawlQueueItem_idempotencyKey_key" ON "SeoCrawlQueueItem"("idempotencyKey");
CREATE INDEX "SeoCrawlQueueItem_crawlRunId_status_idx" ON "SeoCrawlQueueItem"("crawlRunId", "status");
CREATE INDEX "SeoCrawlQueueItem_normalisedUrl_crawlRunId_idx" ON "SeoCrawlQueueItem"("normalisedUrl", "crawlRunId");

CREATE UNIQUE INDEX "SeoCrawlPage_seoSiteId_normalisedUrl_key" ON "SeoCrawlPage"("seoSiteId", "normalisedUrl");
CREATE INDEX "SeoCrawlPage_organisationId_brandId_idx" ON "SeoCrawlPage"("organisationId", "brandId");

CREATE INDEX "SeoPageSnapshot_crawlRunId_idx" ON "SeoPageSnapshot"("crawlRunId");
CREATE INDEX "SeoPageSnapshot_pageId_createdAt_idx" ON "SeoPageSnapshot"("pageId", "createdAt");

CREATE INDEX "SeoCrawlLink_crawlRunId_linkType_idx" ON "SeoCrawlLink"("crawlRunId", "linkType");
CREATE INDEX "SeoCrawlLink_sourcePageId_idx" ON "SeoCrawlLink"("sourcePageId");

CREATE INDEX "SeoCrawlResource_crawlRunId_idx" ON "SeoCrawlResource"("crawlRunId");

CREATE UNIQUE INDEX "SeoIssueDefinition_ruleId_key" ON "SeoIssueDefinition"("ruleId");

CREATE INDEX "SeoCrawlIssue_organisationId_brandId_status_idx" ON "SeoCrawlIssue"("organisationId", "brandId", "status");
CREATE INDEX "SeoCrawlIssue_crawlRunId_severity_idx" ON "SeoCrawlIssue"("crawlRunId", "severity");
CREATE INDEX "SeoCrawlIssue_seoSiteId_ruleId_idx" ON "SeoCrawlIssue"("seoSiteId", "ruleId");

CREATE INDEX "SeoIssueResolution_issueId_idx" ON "SeoIssueResolution"("issueId");

CREATE INDEX "SeoRobotsSnapshot_seoSiteId_fetchedAt_idx" ON "SeoRobotsSnapshot"("seoSiteId", "fetchedAt");

CREATE UNIQUE INDEX "SeoSitemap_seoSiteId_sitemapUrl_key" ON "SeoSitemap"("seoSiteId", "sitemapUrl");
CREATE INDEX "SeoSitemap_organisationId_idx" ON "SeoSitemap"("organisationId");

CREATE UNIQUE INDEX "SeoSitemapUrl_sitemapId_loc_key" ON "SeoSitemapUrl"("sitemapId", "loc");
CREATE INDEX "SeoSitemapUrl_sitemapId_idx" ON "SeoSitemapUrl"("sitemapId");

CREATE INDEX "SeoStructuredDataItem_pageId_idx" ON "SeoStructuredDataItem"("pageId");
CREATE INDEX "SeoStructuredDataItem_seoSiteId_schemaType_idx" ON "SeoStructuredDataItem"("seoSiteId", "schemaType");

ALTER TABLE "SeoSite"
  ADD CONSTRAINT "SeoSite_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoSite"
  ADD CONSTRAINT "SeoSite_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoSite"
  ADD CONSTRAINT "SeoSite_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoSite"
  ADD CONSTRAINT "SeoSite_trackingPropertyId_fkey"
  FOREIGN KEY ("trackingPropertyId") REFERENCES "TrackingProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoSiteDomain"
  ADD CONSTRAINT "SeoSiteDomain_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoSiteDomain"
  ADD CONSTRAINT "SeoSiteDomain_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoSiteDomain"
  ADD CONSTRAINT "SeoSiteDomain_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoSiteDomain"
  ADD CONSTRAINT "SeoSiteDomain_seoSiteId_fkey"
  FOREIGN KEY ("seoSiteId") REFERENCES "SeoSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoSiteDomain"
  ADD CONSTRAINT "SeoSiteDomain_verifiedByUserId_fkey"
  FOREIGN KEY ("verifiedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoCrawlConfiguration"
  ADD CONSTRAINT "SeoCrawlConfiguration_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlConfiguration"
  ADD CONSTRAINT "SeoCrawlConfiguration_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlConfiguration"
  ADD CONSTRAINT "SeoCrawlConfiguration_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlConfiguration"
  ADD CONSTRAINT "SeoCrawlConfiguration_seoSiteId_fkey"
  FOREIGN KEY ("seoSiteId") REFERENCES "SeoSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoCrawlRun"
  ADD CONSTRAINT "SeoCrawlRun_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlRun"
  ADD CONSTRAINT "SeoCrawlRun_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlRun"
  ADD CONSTRAINT "SeoCrawlRun_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlRun"
  ADD CONSTRAINT "SeoCrawlRun_seoSiteId_fkey"
  FOREIGN KEY ("seoSiteId") REFERENCES "SeoSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlRun"
  ADD CONSTRAINT "SeoCrawlRun_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoCrawlQueueItem"
  ADD CONSTRAINT "SeoCrawlQueueItem_crawlRunId_fkey"
  FOREIGN KEY ("crawlRunId") REFERENCES "SeoCrawlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoCrawlPage"
  ADD CONSTRAINT "SeoCrawlPage_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlPage"
  ADD CONSTRAINT "SeoCrawlPage_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlPage"
  ADD CONSTRAINT "SeoCrawlPage_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlPage"
  ADD CONSTRAINT "SeoCrawlPage_seoSiteId_fkey"
  FOREIGN KEY ("seoSiteId") REFERENCES "SeoSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoPageSnapshot"
  ADD CONSTRAINT "SeoPageSnapshot_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoPageSnapshot"
  ADD CONSTRAINT "SeoPageSnapshot_crawlRunId_fkey"
  FOREIGN KEY ("crawlRunId") REFERENCES "SeoCrawlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoPageSnapshot"
  ADD CONSTRAINT "SeoPageSnapshot_pageId_fkey"
  FOREIGN KEY ("pageId") REFERENCES "SeoCrawlPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoCrawlLink"
  ADD CONSTRAINT "SeoCrawlLink_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlLink"
  ADD CONSTRAINT "SeoCrawlLink_crawlRunId_fkey"
  FOREIGN KEY ("crawlRunId") REFERENCES "SeoCrawlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlLink"
  ADD CONSTRAINT "SeoCrawlLink_snapshotId_fkey"
  FOREIGN KEY ("snapshotId") REFERENCES "SeoPageSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlLink"
  ADD CONSTRAINT "SeoCrawlLink_sourcePageId_fkey"
  FOREIGN KEY ("sourcePageId") REFERENCES "SeoCrawlPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlLink"
  ADD CONSTRAINT "SeoCrawlLink_destinationPageId_fkey"
  FOREIGN KEY ("destinationPageId") REFERENCES "SeoCrawlPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoCrawlResource"
  ADD CONSTRAINT "SeoCrawlResource_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlResource"
  ADD CONSTRAINT "SeoCrawlResource_crawlRunId_fkey"
  FOREIGN KEY ("crawlRunId") REFERENCES "SeoCrawlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoCrawlIssue"
  ADD CONSTRAINT "SeoCrawlIssue_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlIssue"
  ADD CONSTRAINT "SeoCrawlIssue_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlIssue"
  ADD CONSTRAINT "SeoCrawlIssue_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlIssue"
  ADD CONSTRAINT "SeoCrawlIssue_seoSiteId_fkey"
  FOREIGN KEY ("seoSiteId") REFERENCES "SeoSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlIssue"
  ADD CONSTRAINT "SeoCrawlIssue_crawlRunId_fkey"
  FOREIGN KEY ("crawlRunId") REFERENCES "SeoCrawlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlIssue"
  ADD CONSTRAINT "SeoCrawlIssue_pageId_fkey"
  FOREIGN KEY ("pageId") REFERENCES "SeoCrawlPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlIssue"
  ADD CONSTRAINT "SeoCrawlIssue_snapshotId_fkey"
  FOREIGN KEY ("snapshotId") REFERENCES "SeoPageSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoCrawlIssue"
  ADD CONSTRAINT "SeoCrawlIssue_ruleId_fkey"
  FOREIGN KEY ("ruleId") REFERENCES "SeoIssueDefinition"("ruleId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SeoIssueResolution"
  ADD CONSTRAINT "SeoIssueResolution_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoIssueResolution"
  ADD CONSTRAINT "SeoIssueResolution_issueId_fkey"
  FOREIGN KEY ("issueId") REFERENCES "SeoCrawlIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoIssueResolution"
  ADD CONSTRAINT "SeoIssueResolution_resolvedByUserId_fkey"
  FOREIGN KEY ("resolvedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoRobotsSnapshot"
  ADD CONSTRAINT "SeoRobotsSnapshot_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoRobotsSnapshot"
  ADD CONSTRAINT "SeoRobotsSnapshot_seoSiteId_fkey"
  FOREIGN KEY ("seoSiteId") REFERENCES "SeoSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoSitemap"
  ADD CONSTRAINT "SeoSitemap_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoSitemap"
  ADD CONSTRAINT "SeoSitemap_seoSiteId_fkey"
  FOREIGN KEY ("seoSiteId") REFERENCES "SeoSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoSitemapUrl"
  ADD CONSTRAINT "SeoSitemapUrl_sitemapId_fkey"
  FOREIGN KEY ("sitemapId") REFERENCES "SeoSitemap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoStructuredDataItem"
  ADD CONSTRAINT "SeoStructuredDataItem_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoStructuredDataItem"
  ADD CONSTRAINT "SeoStructuredDataItem_pageId_fkey"
  FOREIGN KEY ("pageId") REFERENCES "SeoCrawlPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoStructuredDataItem"
  ADD CONSTRAINT "SeoStructuredDataItem_snapshotId_fkey"
  FOREIGN KEY ("snapshotId") REFERENCES "SeoPageSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
