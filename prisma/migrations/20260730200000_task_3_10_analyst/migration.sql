-- Task 3.10: AI marketing analyst

CREATE TYPE "MarketingAnalystRunType" AS ENUM ('QUESTION', 'BRIEF', 'ANOMALY');
CREATE TYPE "MarketingAnalystRunStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
CREATE TYPE "MarketingAnalystRecommendationStatus" AS ENUM ('OPEN', 'DISMISSED', 'ACTIONED');
CREATE TYPE "MarketingAnalystActionType" AS ENUM (
  'CONTENT_BRIEF',
  'EXPERIMENT',
  'CAMPAIGN_TASK',
  'DATA_QUALITY_TASK',
  'CONNECTOR_RECOVERY_TASK',
  'LANDING_PAGE_REVIEW',
  'OBJECTIVE_UPDATE_PROPOSAL'
);

CREATE TABLE "MarketingAnalystRun" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "userProfileId" TEXT NOT NULL,
  "runType" "MarketingAnalystRunType" NOT NULL,
  "question" TEXT,
  "briefType" TEXT,
  "status" "MarketingAnalystRunStatus" NOT NULL DEFAULT 'PENDING',
  "evidencePackage" JSONB NOT NULL,
  "structuredOutput" JSONB,
  "outputSource" TEXT,
  "aiRequestId" TEXT,
  "errorMessage" TEXT,
  "isSaved" BOOLEAN NOT NULL DEFAULT false,
  "filters" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "MarketingAnalystRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingAnalystRecommendation" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "analystRunId" TEXT NOT NULL,
  "actionType" "MarketingAnalystActionType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 2,
  "status" "MarketingAnalystRecommendationStatus" NOT NULL DEFAULT 'OPEN',
  "linkedResourceType" TEXT,
  "linkedResourceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dismissedAt" TIMESTAMP(3),
  "actionedAt" TIMESTAMP(3),
  CONSTRAINT "MarketingAnalystRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingAnalystRun_organisationId_brandId_createdAt_idx"
  ON "MarketingAnalystRun"("organisationId", "brandId", "createdAt");
CREATE INDEX "MarketingAnalystRun_userProfileId_isSaved_idx"
  ON "MarketingAnalystRun"("userProfileId", "isSaved");
CREATE INDEX "MarketingAnalystRun_status_idx" ON "MarketingAnalystRun"("status");

CREATE INDEX "MarketingAnalystRecommendation_organisationId_brandId_status_idx"
  ON "MarketingAnalystRecommendation"("organisationId", "brandId", "status");
CREATE INDEX "MarketingAnalystRecommendation_analystRunId_idx"
  ON "MarketingAnalystRecommendation"("analystRunId");

ALTER TABLE "MarketingAnalystRun"
  ADD CONSTRAINT "MarketingAnalystRun_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAnalystRun"
  ADD CONSTRAINT "MarketingAnalystRun_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAnalystRun"
  ADD CONSTRAINT "MarketingAnalystRun_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAnalystRun"
  ADD CONSTRAINT "MarketingAnalystRun_userProfileId_fkey"
  FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingAnalystRecommendation"
  ADD CONSTRAINT "MarketingAnalystRecommendation_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAnalystRecommendation"
  ADD CONSTRAINT "MarketingAnalystRecommendation_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAnalystRecommendation"
  ADD CONSTRAINT "MarketingAnalystRecommendation_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAnalystRecommendation"
  ADD CONSTRAINT "MarketingAnalystRecommendation_analystRunId_fkey"
  FOREIGN KEY ("analystRunId") REFERENCES "MarketingAnalystRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
