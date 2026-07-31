-- Task 4.4: Topic clusters and SEO content strategy

CREATE TYPE "SeoTopicStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "SeoTopicClusterStatus" AS ENUM ('DRAFT', 'PROPOSED', 'CONFIRMED', 'ARCHIVED');
CREATE TYPE "SeoTopicClusterMemberType" AS ENUM ('KEYWORD', 'PAGE', 'ENTITY', 'COMPETITOR_GAP');
CREATE TYPE "SeoContentFormatType" AS ENUM (
  'PILLAR', 'SUPPORTING_ARTICLE', 'LANDING_PAGE', 'COMPARISON', 'GUIDE',
  'FAQ', 'GLOSSARY', 'CASE_STUDY', 'DOCUMENTATION', 'TOOL', 'OTHER'
);
CREATE TYPE "SeoFunnelStage" AS ENUM (
  'AWARENESS', 'CONSIDERATION', 'DECISION', 'ACTIVATION', 'RETENTION', 'SUPPORT', 'UNSPECIFIED'
);
CREATE TYPE "SeoRoadmapStatus" AS ENUM (
  'IDEA', 'RESEARCH', 'BRIEF_REQUIRED', 'BRIEF_READY', 'DRAFTING', 'REVIEW',
  'PUBLISH_READY', 'PUBLISHED', 'REFRESH_REQUIRED', 'ARCHIVED'
);
CREATE TYPE "SeoContentStrategyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

CREATE TABLE "SeoTopic" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "funnelStage" "SeoFunnelStage" NOT NULL DEFAULT 'UNSPECIFIED',
  "status" "SeoTopicStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoTopic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoTopicCluster" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "topicId" TEXT,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "status" "SeoTopicClusterStatus" NOT NULL DEFAULT 'DRAFT',
  "confidence" DOUBLE PRECISION,
  "evidence" JSONB,
  "namingSource" TEXT NOT NULL DEFAULT 'deterministic',
  "isAiSuggested" BOOLEAN NOT NULL DEFAULT false,
  "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoTopicCluster_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoTopicClusterMember" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "clusterId" TEXT NOT NULL,
  "memberType" "SeoTopicClusterMemberType" NOT NULL,
  "keywordId" TEXT,
  "pageId" TEXT,
  "entityId" TEXT,
  "contentGapId" TEXT,
  "isManuallyConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "isLocked" BOOLEAN NOT NULL DEFAULT false,
  "confidence" DOUBLE PRECISION,
  "evidence" JSONB,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoTopicClusterMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoTopicEntity" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "clusterId" TEXT,
  "entityType" "SeoKeywordEntityType" NOT NULL,
  "canonicalValue" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'clustering',
  "confidence" DOUBLE PRECISION,
  "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoTopicEntity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoPillarPage" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "clusterId" TEXT NOT NULL,
  "formatType" "SeoContentFormatType" NOT NULL DEFAULT 'PILLAR',
  "title" TEXT NOT NULL,
  "targetUrl" TEXT,
  "existingPageId" TEXT,
  "funnelStage" "SeoFunnelStage" NOT NULL DEFAULT 'UNSPECIFIED',
  "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
  "roadmapStatus" "SeoRoadmapStatus" NOT NULL DEFAULT 'IDEA',
  "contentItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoPillarPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoSupportingPage" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "clusterId" TEXT NOT NULL,
  "pillarPageId" TEXT,
  "formatType" "SeoContentFormatType" NOT NULL DEFAULT 'SUPPORTING_ARTICLE',
  "title" TEXT NOT NULL,
  "targetUrl" TEXT,
  "existingPageId" TEXT,
  "funnelStage" "SeoFunnelStage" NOT NULL DEFAULT 'UNSPECIFIED',
  "sequenceOrder" INTEGER NOT NULL DEFAULT 0,
  "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
  "roadmapStatus" "SeoRoadmapStatus" NOT NULL DEFAULT 'IDEA',
  "contentItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoSupportingPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoContentGapPlan" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "clusterId" TEXT,
  "contentGapId" TEXT,
  "title" TEXT NOT NULL,
  "explanation" TEXT,
  "formatType" "SeoContentFormatType" NOT NULL DEFAULT 'GUIDE',
  "funnelStage" "SeoFunnelStage" NOT NULL DEFAULT 'UNSPECIFIED',
  "roadmapStatus" "SeoRoadmapStatus" NOT NULL DEFAULT 'IDEA',
  "contentItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoContentGapPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoContentStrategy" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "SeoContentStrategyStatus" NOT NULL DEFAULT 'DRAFT',
  "currentVersionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoContentStrategy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoContentStrategyVersion" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "strategyId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "summary" JSONB NOT NULL,
  "clusterSnapshot" JSONB,
  "aiProposals" JSONB,
  "isApproved" BOOLEAN NOT NULL DEFAULT false,
  "approvedAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoContentStrategyVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoContentPriorityScore" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "clusterId" TEXT,
  "gapPlanId" TEXT,
  "pillarPageId" TEXT,
  "supportingPageId" TEXT,
  "scoreVersion" TEXT NOT NULL DEFAULT '1.0',
  "totalScore" DOUBLE PRECISION,
  "factors" JSONB NOT NULL,
  "missingFactors" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeoContentPriorityScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeoTopic_brandId_slug_key" ON "SeoTopic"("brandId", "slug");
CREATE INDEX "SeoTopic_organisationId_brandId_status_idx" ON "SeoTopic"("organisationId", "brandId", "status");

CREATE UNIQUE INDEX "SeoTopicCluster_brandId_slug_key" ON "SeoTopicCluster"("brandId", "slug");
CREATE INDEX "SeoTopicCluster_organisationId_brandId_status_idx" ON "SeoTopicCluster"("organisationId", "brandId", "status");

CREATE INDEX "SeoTopicClusterMember_clusterId_memberType_idx" ON "SeoTopicClusterMember"("clusterId", "memberType");
CREATE INDEX "SeoTopicClusterMember_keywordId_idx" ON "SeoTopicClusterMember"("keywordId");
CREATE INDEX "SeoTopicClusterMember_pageId_idx" ON "SeoTopicClusterMember"("pageId");

CREATE INDEX "SeoTopicEntity_clusterId_idx" ON "SeoTopicEntity"("clusterId");
CREATE INDEX "SeoTopicEntity_organisationId_brandId_idx" ON "SeoTopicEntity"("organisationId", "brandId");

CREATE INDEX "SeoPillarPage_clusterId_idx" ON "SeoPillarPage"("clusterId");
CREATE INDEX "SeoPillarPage_organisationId_brandId_roadmapStatus_idx" ON "SeoPillarPage"("organisationId", "brandId", "roadmapStatus");

CREATE INDEX "SeoSupportingPage_clusterId_pillarPageId_idx" ON "SeoSupportingPage"("clusterId", "pillarPageId");
CREATE INDEX "SeoSupportingPage_organisationId_brandId_roadmapStatus_idx" ON "SeoSupportingPage"("organisationId", "brandId", "roadmapStatus");

CREATE INDEX "SeoContentGapPlan_organisationId_brandId_roadmapStatus_idx" ON "SeoContentGapPlan"("organisationId", "brandId", "roadmapStatus");
CREATE INDEX "SeoContentGapPlan_clusterId_idx" ON "SeoContentGapPlan"("clusterId");

CREATE UNIQUE INDEX "SeoContentStrategy_brandId_name_key" ON "SeoContentStrategy"("brandId", "name");
CREATE INDEX "SeoContentStrategy_organisationId_brandId_status_idx" ON "SeoContentStrategy"("organisationId", "brandId", "status");

CREATE UNIQUE INDEX "SeoContentStrategyVersion_strategyId_versionNumber_key" ON "SeoContentStrategyVersion"("strategyId", "versionNumber");
CREATE INDEX "SeoContentStrategyVersion_strategyId_createdAt_idx" ON "SeoContentStrategyVersion"("strategyId", "createdAt");

CREATE INDEX "SeoContentPriorityScore_organisationId_brandId_calculatedAt_idx" ON "SeoContentPriorityScore"("organisationId", "brandId", "calculatedAt");
CREATE INDEX "SeoContentPriorityScore_clusterId_idx" ON "SeoContentPriorityScore"("clusterId");

ALTER TABLE "SeoTopic" ADD CONSTRAINT "SeoTopic_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoTopic" ADD CONSTRAINT "SeoTopic_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoTopic" ADD CONSTRAINT "SeoTopic_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoTopicCluster" ADD CONSTRAINT "SeoTopicCluster_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoTopicCluster" ADD CONSTRAINT "SeoTopicCluster_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoTopicCluster" ADD CONSTRAINT "SeoTopicCluster_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoTopicCluster" ADD CONSTRAINT "SeoTopicCluster_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "SeoTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoTopicClusterMember" ADD CONSTRAINT "SeoTopicClusterMember_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoTopicClusterMember" ADD CONSTRAINT "SeoTopicClusterMember_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "SeoTopicCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoTopicClusterMember" ADD CONSTRAINT "SeoTopicClusterMember_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "SeoKeyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoTopicClusterMember" ADD CONSTRAINT "SeoTopicClusterMember_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SeoCrawlPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoTopicClusterMember" ADD CONSTRAINT "SeoTopicClusterMember_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "SeoTopicEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoTopicClusterMember" ADD CONSTRAINT "SeoTopicClusterMember_contentGapId_fkey" FOREIGN KEY ("contentGapId") REFERENCES "SeoContentGap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoTopicEntity" ADD CONSTRAINT "SeoTopicEntity_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoTopicEntity" ADD CONSTRAINT "SeoTopicEntity_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "SeoTopicCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoPillarPage" ADD CONSTRAINT "SeoPillarPage_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoPillarPage" ADD CONSTRAINT "SeoPillarPage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoPillarPage" ADD CONSTRAINT "SeoPillarPage_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoPillarPage" ADD CONSTRAINT "SeoPillarPage_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "SeoTopicCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoPillarPage" ADD CONSTRAINT "SeoPillarPage_existingPageId_fkey" FOREIGN KEY ("existingPageId") REFERENCES "SeoCrawlPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoPillarPage" ADD CONSTRAINT "SeoPillarPage_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoSupportingPage" ADD CONSTRAINT "SeoSupportingPage_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoSupportingPage" ADD CONSTRAINT "SeoSupportingPage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoSupportingPage" ADD CONSTRAINT "SeoSupportingPage_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoSupportingPage" ADD CONSTRAINT "SeoSupportingPage_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "SeoTopicCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoSupportingPage" ADD CONSTRAINT "SeoSupportingPage_pillarPageId_fkey" FOREIGN KEY ("pillarPageId") REFERENCES "SeoPillarPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoSupportingPage" ADD CONSTRAINT "SeoSupportingPage_existingPageId_fkey" FOREIGN KEY ("existingPageId") REFERENCES "SeoCrawlPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoSupportingPage" ADD CONSTRAINT "SeoSupportingPage_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoContentGapPlan" ADD CONSTRAINT "SeoContentGapPlan_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentGapPlan" ADD CONSTRAINT "SeoContentGapPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentGapPlan" ADD CONSTRAINT "SeoContentGapPlan_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentGapPlan" ADD CONSTRAINT "SeoContentGapPlan_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "SeoTopicCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoContentGapPlan" ADD CONSTRAINT "SeoContentGapPlan_contentGapId_fkey" FOREIGN KEY ("contentGapId") REFERENCES "SeoContentGap"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoContentGapPlan" ADD CONSTRAINT "SeoContentGapPlan_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeoContentStrategy" ADD CONSTRAINT "SeoContentStrategy_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentStrategy" ADD CONSTRAINT "SeoContentStrategy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentStrategy" ADD CONSTRAINT "SeoContentStrategy_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoContentStrategyVersion" ADD CONSTRAINT "SeoContentStrategyVersion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentStrategyVersion" ADD CONSTRAINT "SeoContentStrategyVersion_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "SeoContentStrategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentStrategyVersion" ADD CONSTRAINT "SeoContentStrategyVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SeoContentPriorityScore" ADD CONSTRAINT "SeoContentPriorityScore_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeoContentPriorityScore" ADD CONSTRAINT "SeoContentPriorityScore_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "SeoTopicCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoContentPriorityScore" ADD CONSTRAINT "SeoContentPriorityScore_gapPlanId_fkey" FOREIGN KEY ("gapPlanId") REFERENCES "SeoContentGapPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoContentPriorityScore" ADD CONSTRAINT "SeoContentPriorityScore_pillarPageId_fkey" FOREIGN KEY ("pillarPageId") REFERENCES "SeoPillarPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeoContentPriorityScore" ADD CONSTRAINT "SeoContentPriorityScore_supportingPageId_fkey" FOREIGN KEY ("supportingPageId") REFERENCES "SeoSupportingPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
