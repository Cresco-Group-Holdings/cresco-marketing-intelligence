-- Task 3.7: Funnel and conversion intelligence

CREATE TYPE "FunnelCountingMethod" AS ENUM ('USER', 'SESSION', 'EVENT');
CREATE TYPE "FunnelStepType" AS ENUM ('EVENT', 'CONVERSION', 'PAGE', 'CAMPAIGN', 'LEAD_STATUS', 'CRM_STAGE', 'SUBSCRIPTION_STATUS', 'PAYMENT_STATUS');
CREATE TYPE "FunnelStepRequirement" AS ENUM ('REQUIRED', 'OPTIONAL');
CREATE TYPE "FunnelTemplateType" AS ENUM ('CRESCO_GRANTS', 'CAPITAL_CRESCO_TERMINAL');
CREATE TYPE "FunnelAnalysisRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "FunnelSegmentDimension" AS ENUM ('CHANNEL', 'CAMPAIGN', 'PROVIDER', 'LANDING_PAGE', 'DEVICE', 'COUNTRY', 'NEW_VS_RETURNING', 'BRAND', 'AUDIENCE', 'CONTENT', 'DATE_COHORT');
CREATE TYPE "FunnelDropOffInsightType" AS ENUM ('LARGEST_DROP_OFF', 'SLOW_TRANSITION', 'WORSENING_CONVERSION', 'STRONG_TRAFFIC_WEAK_ACTIVATION', 'HIGH_SIGNUP_LOW_COMPLETION', 'LOW_QUALITY_CONVERSIONS');

CREATE TABLE "MarketingFunnel" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "countingMethod" "FunnelCountingMethod" NOT NULL DEFAULT 'USER',
    "templateType" "FunnelTemplateType",
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingFunnel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingFunnelVersion" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "funnelId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "countingMethod" "FunnelCountingMethod" NOT NULL,
    "config" JSONB,
    "changelog" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingFunnelVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingFunnelStep" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "funnelVersionId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "stepType" "FunnelStepType" NOT NULL,
    "matchingRules" JSONB NOT NULL,
    "maxTimeToNextStepMs" INTEGER,
    "requirement" "FunnelStepRequirement" NOT NULL DEFAULT 'REQUIRED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingFunnelStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FunnelAnalysisRun" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "funnelId" TEXT NOT NULL,
    "funnelVersionId" TEXT NOT NULL,
    "status" "FunnelAnalysisRunStatus" NOT NULL DEFAULT 'PENDING',
    "countingMethod" "FunnelCountingMethod" NOT NULL,
    "cohortDate" TIMESTAMP(3),
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "segmentDimension" "FunnelSegmentDimension",
    "segmentValue" TEXT,
    "entrants" INTEGER NOT NULL DEFAULT 0,
    "totalConversions" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "journeySamples" JSONB,
    "dataQualityWarnings" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FunnelAnalysisRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FunnelStepResult" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "funnelAnalysisRunId" TEXT NOT NULL,
    "funnelStepId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "stepName" TEXT NOT NULL,
    "entrants" INTEGER NOT NULL,
    "completions" INTEGER NOT NULL,
    "stepConversion" DECIMAL(8,4) NOT NULL,
    "cumulativeConversion" DECIMAL(8,4) NOT NULL,
    "dropOffCount" INTEGER NOT NULL,
    "dropOffRate" DECIMAL(8,4) NOT NULL,
    "medianTimeToNextMs" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FunnelStepResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FunnelSegment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "funnelAnalysisRunId" TEXT NOT NULL,
    "dimension" "FunnelSegmentDimension" NOT NULL,
    "segmentValue" TEXT NOT NULL,
    "entrants" INTEGER NOT NULL DEFAULT 0,
    "completions" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DECIMAL(8,4),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FunnelSegment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FunnelDropOffInsight" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "funnelAnalysisRunId" TEXT NOT NULL,
    "insightType" "FunnelDropOffInsightType" NOT NULL,
    "stepOrder" INTEGER,
    "stepName" TEXT,
    "segmentDimension" TEXT,
    "segmentValue" TEXT,
    "metricValue" DECIMAL(12,4),
    "evidence" JSONB,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FunnelDropOffInsight_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingFunnel_brandId_name_key" ON "MarketingFunnel"("brandId", "name");
CREATE INDEX "MarketingFunnel_organisationId_brandId_idx" ON "MarketingFunnel"("organisationId", "brandId");
CREATE INDEX "MarketingFunnel_isActive_idx" ON "MarketingFunnel"("isActive");

CREATE UNIQUE INDEX "MarketingFunnelVersion_funnelId_versionNumber_key" ON "MarketingFunnelVersion"("funnelId", "versionNumber");
CREATE INDEX "MarketingFunnelVersion_organisationId_brandId_idx" ON "MarketingFunnelVersion"("organisationId", "brandId");

CREATE UNIQUE INDEX "MarketingFunnelStep_funnelVersionId_stepOrder_key" ON "MarketingFunnelStep"("funnelVersionId", "stepOrder");
CREATE INDEX "MarketingFunnelStep_organisationId_brandId_idx" ON "MarketingFunnelStep"("organisationId", "brandId");

CREATE UNIQUE INDEX "FunnelAnalysisRun_idempotencyKey_key" ON "FunnelAnalysisRun"("idempotencyKey");
CREATE INDEX "FunnelAnalysisRun_organisationId_brandId_createdAt_idx" ON "FunnelAnalysisRun"("organisationId", "brandId", "createdAt");
CREATE INDEX "FunnelAnalysisRun_funnelId_idx" ON "FunnelAnalysisRun"("funnelId");
CREATE INDEX "FunnelAnalysisRun_status_idx" ON "FunnelAnalysisRun"("status");

CREATE INDEX "FunnelStepResult_funnelAnalysisRunId_idx" ON "FunnelStepResult"("funnelAnalysisRunId");
CREATE INDEX "FunnelStepResult_stepOrder_idx" ON "FunnelStepResult"("stepOrder");

CREATE INDEX "FunnelSegment_funnelAnalysisRunId_idx" ON "FunnelSegment"("funnelAnalysisRunId");
CREATE INDEX "FunnelSegment_dimension_idx" ON "FunnelSegment"("dimension");

CREATE INDEX "FunnelDropOffInsight_funnelAnalysisRunId_idx" ON "FunnelDropOffInsight"("funnelAnalysisRunId");
CREATE INDEX "FunnelDropOffInsight_insightType_idx" ON "FunnelDropOffInsight"("insightType");

ALTER TABLE "MarketingFunnel" ADD CONSTRAINT "MarketingFunnel_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingFunnel" ADD CONSTRAINT "MarketingFunnel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingFunnel" ADD CONSTRAINT "MarketingFunnel_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingFunnelVersion" ADD CONSTRAINT "MarketingFunnelVersion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingFunnelVersion" ADD CONSTRAINT "MarketingFunnelVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingFunnelVersion" ADD CONSTRAINT "MarketingFunnelVersion_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingFunnelVersion" ADD CONSTRAINT "MarketingFunnelVersion_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "MarketingFunnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingFunnelStep" ADD CONSTRAINT "MarketingFunnelStep_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingFunnelStep" ADD CONSTRAINT "MarketingFunnelStep_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingFunnelStep" ADD CONSTRAINT "MarketingFunnelStep_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingFunnelStep" ADD CONSTRAINT "MarketingFunnelStep_funnelVersionId_fkey" FOREIGN KEY ("funnelVersionId") REFERENCES "MarketingFunnelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FunnelAnalysisRun" ADD CONSTRAINT "FunnelAnalysisRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FunnelAnalysisRun" ADD CONSTRAINT "FunnelAnalysisRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FunnelAnalysisRun" ADD CONSTRAINT "FunnelAnalysisRun_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FunnelAnalysisRun" ADD CONSTRAINT "FunnelAnalysisRun_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "MarketingFunnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FunnelAnalysisRun" ADD CONSTRAINT "FunnelAnalysisRun_funnelVersionId_fkey" FOREIGN KEY ("funnelVersionId") REFERENCES "MarketingFunnelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FunnelStepResult" ADD CONSTRAINT "FunnelStepResult_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FunnelStepResult" ADD CONSTRAINT "FunnelStepResult_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FunnelStepResult" ADD CONSTRAINT "FunnelStepResult_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FunnelStepResult" ADD CONSTRAINT "FunnelStepResult_funnelAnalysisRunId_fkey" FOREIGN KEY ("funnelAnalysisRunId") REFERENCES "FunnelAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FunnelStepResult" ADD CONSTRAINT "FunnelStepResult_funnelStepId_fkey" FOREIGN KEY ("funnelStepId") REFERENCES "MarketingFunnelStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FunnelSegment" ADD CONSTRAINT "FunnelSegment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FunnelSegment" ADD CONSTRAINT "FunnelSegment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FunnelSegment" ADD CONSTRAINT "FunnelSegment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FunnelSegment" ADD CONSTRAINT "FunnelSegment_funnelAnalysisRunId_fkey" FOREIGN KEY ("funnelAnalysisRunId") REFERENCES "FunnelAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FunnelDropOffInsight" ADD CONSTRAINT "FunnelDropOffInsight_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FunnelDropOffInsight" ADD CONSTRAINT "FunnelDropOffInsight_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FunnelDropOffInsight" ADD CONSTRAINT "FunnelDropOffInsight_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FunnelDropOffInsight" ADD CONSTRAINT "FunnelDropOffInsight_funnelAnalysisRunId_fkey" FOREIGN KEY ("funnelAnalysisRunId") REFERENCES "FunnelAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
