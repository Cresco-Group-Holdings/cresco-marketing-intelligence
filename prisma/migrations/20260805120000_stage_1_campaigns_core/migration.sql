-- Stage 1: Canonical Campaigns Core

-- Rename ContentCampaign member table to avoid collision with canonical Campaign members
ALTER TABLE "CampaignMember" RENAME TO "ContentCampaignMember";
ALTER INDEX "CampaignMember_pkey" RENAME TO "ContentCampaignMember_pkey";
ALTER INDEX "CampaignMember_campaignId_userId_key" RENAME TO "ContentCampaignMember_campaignId_userId_key";
ALTER INDEX "CampaignMember_userId_idx" RENAME TO "ContentCampaignMember_userId_idx";
ALTER TABLE "ContentCampaignMember" RENAME CONSTRAINT "CampaignMember_campaignId_fkey" TO "ContentCampaignMember_campaignId_fkey";
ALTER TABLE "ContentCampaignMember" RENAME CONSTRAINT "CampaignMember_userId_fkey" TO "ContentCampaignMember_userId_fkey";

CREATE TYPE "CampaignStatus" AS ENUM (
  'DRAFT',
  'PLANNED',
  'READY',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED'
);

CREATE TYPE "CampaignLifecycleStage" AS ENUM (
  'INTAKE',
  'PLANNING',
  'EXECUTION',
  'OPTIMIZATION',
  'WRAP_UP',
  'CLOSED'
);

CREATE TYPE "CampaignObjective" AS ENUM (
  'BRAND_AWARENESS',
  'LEAD_GENERATION',
  'WEBSITE_TRAFFIC',
  'ENGAGEMENT',
  'CONVERSIONS',
  'RETENTION'
);

CREATE TYPE "CampaignBudgetType" AS ENUM (
  'TOTAL',
  'DAILY',
  'MONTHLY',
  'LIFETIME'
);

CREATE TYPE "CampaignChannelType" AS ENUM (
  'ORGANIC_SOCIAL',
  'PAID_SOCIAL',
  'EMAIL',
  'SEO',
  'PAID_SEARCH',
  'DISPLAY',
  'EVENTS',
  'PARTNERSHIPS',
  'OTHER'
);

CREATE TYPE "CampaignChannelStatus" AS ENUM (
  'PLANNED',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "CampaignMemberRole" AS ENUM (
  'OWNER',
  'MANAGER',
  'CONTRIBUTOR',
  'VIEWER'
);

CREATE TYPE "CampaignKpiSourceType" AS ENUM (
  'MANUAL',
  'WAREHOUSE',
  'CONNECTOR',
  'CALCULATED'
);

CREATE TYPE "CampaignActivityType" AS ENUM (
  'CREATED',
  'UPDATED',
  'STATUS_TRANSITION',
  'LIFECYCLE_CHANGED',
  'CHANNEL_ADDED',
  'CHANNEL_UPDATED',
  'CHANNEL_REMOVED',
  'KPI_ADDED',
  'KPI_UPDATED',
  'KPI_REMOVED',
  'MEMBER_ADDED',
  'MEMBER_UPDATED',
  'MEMBER_REMOVED',
  'ARCHIVED',
  'RESTORED'
);

CREATE TABLE "Campaign" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "lifecycleStage" "CampaignLifecycleStage" NOT NULL DEFAULT 'INTAKE',
  "primaryObjective" "CampaignObjective",
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "budgetType" "CampaignBudgetType",
  "budgetAmount" DECIMAL(18,4),
  "budgetCurrency" TEXT,
  "strategyNarrative" TEXT,
  "strategyTargetOutcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "audienceDescription" TEXT,
  "audienceSegments" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "targetAudienceId" TEXT,
  "ownerUserId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignChannel" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "channelType" "CampaignChannelType" NOT NULL,
  "status" "CampaignChannelStatus" NOT NULL DEFAULT 'PLANNED',
  "name" TEXT,
  "provider" TEXT,
  "budgetAmount" DECIMAL(18,4),
  "budgetCurrency" TEXT,
  "notes" TEXT,
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "externalRef" TEXT,
  "metadata" JSONB,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignChannel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignKpi" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "metricKey" TEXT,
  "targetValue" DECIMAL(18,4),
  "currentValue" DECIMAL(18,4),
  "unit" TEXT,
  "sourceType" "CampaignKpiSourceType" NOT NULL DEFAULT 'MANUAL',
  "sourceRef" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignKpi_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignMember" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "CampaignMemberRole" NOT NULL DEFAULT 'CONTRIBUTOR',
  "addedByUserId" TEXT NOT NULL,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "CampaignMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignActivity" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "activityType" "CampaignActivityType" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Campaign_organisationId_brandId_status_idx" ON "Campaign"("organisationId", "brandId", "status");
CREATE INDEX "Campaign_organisationId_archivedAt_idx" ON "Campaign"("organisationId", "archivedAt");
CREATE INDEX "Campaign_ownerUserId_idx" ON "Campaign"("ownerUserId");
CREATE INDEX "Campaign_startAt_endAt_idx" ON "Campaign"("startAt", "endAt");
CREATE INDEX "Campaign_projectId_idx" ON "Campaign"("projectId");

CREATE INDEX "CampaignChannel_campaignId_channelType_idx" ON "CampaignChannel"("campaignId", "channelType");
CREATE INDEX "CampaignChannel_organisationId_idx" ON "CampaignChannel"("organisationId");

CREATE INDEX "CampaignKpi_campaignId_sortOrder_idx" ON "CampaignKpi"("campaignId", "sortOrder");
CREATE INDEX "CampaignKpi_organisationId_idx" ON "CampaignKpi"("organisationId");

CREATE UNIQUE INDEX "CampaignMember_campaignId_userId_key" ON "CampaignMember"("campaignId", "userId");
CREATE INDEX "CampaignMember_userId_idx" ON "CampaignMember"("userId");

CREATE INDEX "CampaignActivity_organisationId_brandId_createdAt_idx" ON "CampaignActivity"("organisationId", "brandId", "createdAt");
CREATE INDEX "CampaignActivity_campaignId_createdAt_idx" ON "CampaignActivity"("campaignId", "createdAt");

ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_targetAudienceId_fkey" FOREIGN KEY ("targetAudienceId") REFERENCES "BrandAudience"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampaignChannel" ADD CONSTRAINT "CampaignChannel_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignChannel" ADD CONSTRAINT "CampaignChannel_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignKpi" ADD CONSTRAINT "CampaignKpi_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignKpi" ADD CONSTRAINT "CampaignKpi_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignMember" ADD CONSTRAINT "CampaignMember_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignMember" ADD CONSTRAINT "CampaignMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignMember" ADD CONSTRAINT "CampaignMember_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CampaignActivity" ADD CONSTRAINT "CampaignActivity_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignActivity" ADD CONSTRAINT "CampaignActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignActivity" ADD CONSTRAINT "CampaignActivity_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignActivity" ADD CONSTRAINT "CampaignActivity_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignActivity" ADD CONSTRAINT "CampaignActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
