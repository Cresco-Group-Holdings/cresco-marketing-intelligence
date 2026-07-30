-- Task 4.2: Keyword intelligence

CREATE TYPE "SeoKeywordStatus" AS ENUM ('ACTIVE', 'WATCHING', 'EXCLUDED', 'ARCHIVED');
CREATE TYPE "SeoKeywordSourceType" AS ENUM (
  'SEARCH_CONSOLE',
  'MANUAL',
  'CSV_IMPORT',
  'SITE_CONTENT',
  'INTERNAL_SEARCH',
  'PROVIDER_EXTENSION',
  'AI_SUGGESTION'
);
CREATE TYPE "SeoKeywordIntentType" AS ENUM (
  'INFORMATIONAL',
  'NAVIGATIONAL',
  'COMMERCIAL',
  'TRANSACTIONAL',
  'LOCAL',
  'SUPPORT',
  'MIXED',
  'UNKNOWN'
);
CREATE TYPE "SeoKeywordPageRelationType" AS ENUM (
  'PRIMARY_TARGET',
  'SECONDARY_TARGET',
  'CURRENTLY_RANKING',
  'POTENTIAL_TARGET',
  'CONFLICTING_TARGET',
  'NOT_RELEVANT'
);
CREATE TYPE "SeoCannibalisationStatus" AS ENUM ('POSSIBLE', 'LIKELY', 'CONFIRMED', 'DISMISSED');
CREATE TYPE "SeoKeywordMetricType" AS ENUM (
  'IMPRESSIONS',
  'CLICKS',
  'CTR',
  'AVERAGE_POSITION',
  'SEARCH_VOLUME',
  'CPC',
  'COMPETITION',
  'DIFFICULTY',
  'TREND',
  'RESULT_COUNT',
  'RANKING_URL',
  'RANK_POSITION'
);
CREATE TYPE "SeoKeywordOpportunityType" AS ENUM (
  'HIGH_IMPRESSIONS_LOW_CTR',
  'POSITION_4_TO_20',
  'INCREASING_IMPRESSIONS',
  'DECLINING_POSITION',
  'NO_TARGET_PAGE',
  'WEAK_TARGET_PAGE',
  'BRANDED_NO_RESULT',
  'INCOMPLETE_CLUSTER'
);
CREATE TYPE "SeoKeywordEntityType" AS ENUM (
  'PRODUCT',
  'ORGANISATION',
  'LOCATION',
  'SECTOR',
  'SERVICE',
  'PROBLEM',
  'AUDIENCE',
  'REGULATION',
  'TECHNOLOGY',
  'OTHER'
);
CREATE TYPE "SeoKeywordImportStatus" AS ENUM (
  'VALIDATING',
  'PREVIEW',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE "SeoKeyword" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "seoSiteId" TEXT,
  "normalisedKeyword" TEXT NOT NULL,
  "displayKeyword" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'en',
  "country" TEXT,
  "locale" TEXT,
  "status" "SeoKeywordStatus" NOT NULL DEFAULT 'ACTIVE',
  "primaryIntent" "SeoKeywordIntentType" NOT NULL DEFAULT 'UNKNOWN',
  "sourceCount" INTEGER NOT NULL DEFAULT 0,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoKeyword_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoKeywordSource" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "keywordId" TEXT NOT NULL,
  "sourceType" "SeoKeywordSourceType" NOT NULL,
  "provider" TEXT,
  "externalId" TEXT,
  "isSuggestion" BOOLEAN NOT NULL DEFAULT false,
  "confidence" DOUBLE PRECISION,
  "metadata" JSONB,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoKeywordSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoKeywordMetric" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "keywordId" TEXT NOT NULL,
  "metricType" "SeoKeywordMetricType" NOT NULL,
  "provider" TEXT NOT NULL,
  "source" "SeoKeywordSourceType" NOT NULL,
  "location" TEXT,
  "language" TEXT,
  "value" DOUBLE PRECISION,
  "stringValue" TEXT,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "confidence" DOUBLE PRECISION,
  "freshness" TEXT,
  "providerDefinition" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoKeywordMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoKeywordMetricSnapshot" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "keywordId" TEXT NOT NULL,
  "metricId" TEXT NOT NULL,
  "metricType" "SeoKeywordMetricType" NOT NULL,
  "value" DOUBLE PRECISION,
  "stringValue" TEXT,
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoKeywordMetricSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoKeywordGroup" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "groupType" TEXT NOT NULL DEFAULT 'topic',
  "isAiSuggested" BOOLEAN NOT NULL DEFAULT false,
  "isConfirmed" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoKeywordGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoKeywordGroupMember" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "keywordId" TEXT NOT NULL,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoKeywordGroupMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoKeywordIntent" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "keywordId" TEXT NOT NULL,
  "intent" "SeoKeywordIntentType" NOT NULL,
  "confidence" DOUBLE PRECISION,
  "source" TEXT NOT NULL DEFAULT 'deterministic',
  "evidence" JSONB,
  "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
  "overriddenByUserId" TEXT,
  "modelId" TEXT,
  "promptVersion" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoKeywordIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoKeywordEntity" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "keywordId" TEXT NOT NULL,
  "entityType" "SeoKeywordEntityType" NOT NULL,
  "canonicalValue" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "source" TEXT NOT NULL DEFAULT 'ai',
  "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "confirmedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoKeywordEntity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoKeywordPageMapping" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "keywordId" TEXT NOT NULL,
  "pageId" TEXT,
  "intendedUrl" TEXT,
  "relationType" "SeoKeywordPageRelationType" NOT NULL,
  "confidence" DOUBLE PRECISION,
  "evidence" JSONB,
  "isManual" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoKeywordPageMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoKeywordTag" (
  "id" TEXT NOT NULL,
  "keywordId" TEXT NOT NULL,
  "tag" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoKeywordTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoKeywordImport" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "seoSiteId" TEXT,
  "status" "SeoKeywordImportStatus" NOT NULL DEFAULT 'VALIDATING',
  "fileName" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'CSV_IMPORT',
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "acceptedCount" INTEGER NOT NULL DEFAULT 0,
  "rejectedCount" INTEGER NOT NULL DEFAULT 0,
  "idempotencyKey" TEXT NOT NULL,
  "columnMappings" JSONB,
  "preview" JSONB,
  "rejectedRows" JSONB,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "SeoKeywordImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoKeywordOpportunity" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "keywordId" TEXT NOT NULL,
  "opportunityType" "SeoKeywordOpportunityType" NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "title" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "recommendedAction" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dismissedAt" TIMESTAMP(3),
  CONSTRAINT "SeoKeywordOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoKeywordStatusHistory" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "keywordId" TEXT NOT NULL,
  "fromStatus" "SeoKeywordStatus",
  "toStatus" "SeoKeywordStatus" NOT NULL,
  "note" TEXT,
  "changedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoKeywordStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeoKeyword_brandId_normalisedKeyword_language_country_key" ON "SeoKeyword"("brandId", "normalisedKeyword", "language", "country");
CREATE INDEX "SeoKeyword_organisationId_brandId_status_idx" ON "SeoKeyword"("organisationId", "brandId", "status");
CREATE INDEX "SeoKeyword_seoSiteId_idx" ON "SeoKeyword"("seoSiteId");
CREATE INDEX "SeoKeyword_primaryIntent_idx" ON "SeoKeyword"("primaryIntent");

CREATE UNIQUE INDEX "SeoKeywordSource_keywordId_sourceType_externalId_key" ON "SeoKeywordSource"("keywordId", "sourceType", "externalId");
CREATE INDEX "SeoKeywordSource_keywordId_sourceType_idx" ON "SeoKeywordSource"("keywordId", "sourceType");

CREATE UNIQUE INDEX "SeoKeywordMetric_keywordId_metricType_provider_source_location_language_measuredAt_key" ON "SeoKeywordMetric"("keywordId", "metricType", "provider", "source", "location", "language", "measuredAt");
CREATE INDEX "SeoKeywordMetric_keywordId_metricType_idx" ON "SeoKeywordMetric"("keywordId", "metricType");

CREATE UNIQUE INDEX "SeoKeywordMetricSnapshot_idempotencyKey_key" ON "SeoKeywordMetricSnapshot"("idempotencyKey");
CREATE INDEX "SeoKeywordMetricSnapshot_keywordId_measuredAt_idx" ON "SeoKeywordMetricSnapshot"("keywordId", "measuredAt");

CREATE UNIQUE INDEX "SeoKeywordGroup_brandId_name_key" ON "SeoKeywordGroup"("brandId", "name");
CREATE INDEX "SeoKeywordGroup_organisationId_brandId_idx" ON "SeoKeywordGroup"("organisationId", "brandId");

CREATE UNIQUE INDEX "SeoKeywordGroupMember_groupId_keywordId_key" ON "SeoKeywordGroupMember"("groupId", "keywordId");
CREATE INDEX "SeoKeywordGroupMember_keywordId_idx" ON "SeoKeywordGroupMember"("keywordId");

CREATE INDEX "SeoKeywordIntent_keywordId_createdAt_idx" ON "SeoKeywordIntent"("keywordId", "createdAt");

CREATE INDEX "SeoKeywordEntity_keywordId_entityType_idx" ON "SeoKeywordEntity"("keywordId", "entityType");

CREATE INDEX "SeoKeywordPageMapping_keywordId_relationType_idx" ON "SeoKeywordPageMapping"("keywordId", "relationType");
CREATE INDEX "SeoKeywordPageMapping_pageId_idx" ON "SeoKeywordPageMapping"("pageId");

CREATE UNIQUE INDEX "SeoKeywordTag_keywordId_tag_key" ON "SeoKeywordTag"("keywordId", "tag");
CREATE INDEX "SeoKeywordTag_tag_idx" ON "SeoKeywordTag"("tag");

CREATE UNIQUE INDEX "SeoKeywordImport_idempotencyKey_key" ON "SeoKeywordImport"("idempotencyKey");
CREATE INDEX "SeoKeywordImport_organisationId_brandId_status_idx" ON "SeoKeywordImport"("organisationId", "brandId", "status");

CREATE INDEX "SeoKeywordOpportunity_organisationId_brandId_status_idx" ON "SeoKeywordOpportunity"("organisationId", "brandId", "status");
CREATE INDEX "SeoKeywordOpportunity_keywordId_opportunityType_idx" ON "SeoKeywordOpportunity"("keywordId", "opportunityType");

CREATE INDEX "SeoKeywordStatusHistory_keywordId_createdAt_idx" ON "SeoKeywordStatusHistory"("keywordId", "createdAt");

ALTER TABLE "SeoKeyword"
  ADD CONSTRAINT "SeoKeyword_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeyword"
  ADD CONSTRAINT "SeoKeyword_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeyword"
  ADD CONSTRAINT "SeoKeyword_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeyword"
  ADD CONSTRAINT "SeoKeyword_seoSiteId_fkey"
  FOREIGN KEY ("seoSiteId") REFERENCES "SeoSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoKeywordSource"
  ADD CONSTRAINT "SeoKeywordSource_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordSource"
  ADD CONSTRAINT "SeoKeywordSource_keywordId_fkey"
  FOREIGN KEY ("keywordId") REFERENCES "SeoKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoKeywordMetric"
  ADD CONSTRAINT "SeoKeywordMetric_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordMetric"
  ADD CONSTRAINT "SeoKeywordMetric_keywordId_fkey"
  FOREIGN KEY ("keywordId") REFERENCES "SeoKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoKeywordMetricSnapshot"
  ADD CONSTRAINT "SeoKeywordMetricSnapshot_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordMetricSnapshot"
  ADD CONSTRAINT "SeoKeywordMetricSnapshot_keywordId_fkey"
  FOREIGN KEY ("keywordId") REFERENCES "SeoKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordMetricSnapshot"
  ADD CONSTRAINT "SeoKeywordMetricSnapshot_metricId_fkey"
  FOREIGN KEY ("metricId") REFERENCES "SeoKeywordMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoKeywordGroup"
  ADD CONSTRAINT "SeoKeywordGroup_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordGroup"
  ADD CONSTRAINT "SeoKeywordGroup_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordGroup"
  ADD CONSTRAINT "SeoKeywordGroup_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoKeywordGroupMember"
  ADD CONSTRAINT "SeoKeywordGroupMember_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "SeoKeywordGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordGroupMember"
  ADD CONSTRAINT "SeoKeywordGroupMember_keywordId_fkey"
  FOREIGN KEY ("keywordId") REFERENCES "SeoKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoKeywordIntent"
  ADD CONSTRAINT "SeoKeywordIntent_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordIntent"
  ADD CONSTRAINT "SeoKeywordIntent_keywordId_fkey"
  FOREIGN KEY ("keywordId") REFERENCES "SeoKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordIntent"
  ADD CONSTRAINT "SeoKeywordIntent_overriddenByUserId_fkey"
  FOREIGN KEY ("overriddenByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoKeywordEntity"
  ADD CONSTRAINT "SeoKeywordEntity_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordEntity"
  ADD CONSTRAINT "SeoKeywordEntity_keywordId_fkey"
  FOREIGN KEY ("keywordId") REFERENCES "SeoKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordEntity"
  ADD CONSTRAINT "SeoKeywordEntity_confirmedByUserId_fkey"
  FOREIGN KEY ("confirmedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoKeywordPageMapping"
  ADD CONSTRAINT "SeoKeywordPageMapping_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordPageMapping"
  ADD CONSTRAINT "SeoKeywordPageMapping_keywordId_fkey"
  FOREIGN KEY ("keywordId") REFERENCES "SeoKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordPageMapping"
  ADD CONSTRAINT "SeoKeywordPageMapping_pageId_fkey"
  FOREIGN KEY ("pageId") REFERENCES "SeoCrawlPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoKeywordTag"
  ADD CONSTRAINT "SeoKeywordTag_keywordId_fkey"
  FOREIGN KEY ("keywordId") REFERENCES "SeoKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoKeywordImport"
  ADD CONSTRAINT "SeoKeywordImport_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordImport"
  ADD CONSTRAINT "SeoKeywordImport_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordImport"
  ADD CONSTRAINT "SeoKeywordImport_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordImport"
  ADD CONSTRAINT "SeoKeywordImport_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoKeywordOpportunity"
  ADD CONSTRAINT "SeoKeywordOpportunity_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordOpportunity"
  ADD CONSTRAINT "SeoKeywordOpportunity_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordOpportunity"
  ADD CONSTRAINT "SeoKeywordOpportunity_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordOpportunity"
  ADD CONSTRAINT "SeoKeywordOpportunity_keywordId_fkey"
  FOREIGN KEY ("keywordId") REFERENCES "SeoKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoKeywordStatusHistory"
  ADD CONSTRAINT "SeoKeywordStatusHistory_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordStatusHistory"
  ADD CONSTRAINT "SeoKeywordStatusHistory_keywordId_fkey"
  FOREIGN KEY ("keywordId") REFERENCES "SeoKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoKeywordStatusHistory"
  ADD CONSTRAINT "SeoKeywordStatusHistory_changedByUserId_fkey"
  FOREIGN KEY ("changedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
