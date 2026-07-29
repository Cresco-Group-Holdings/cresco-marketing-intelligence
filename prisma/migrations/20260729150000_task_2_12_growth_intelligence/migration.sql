-- Task 2.12: Organic Growth Intelligence Engine

CREATE TYPE "GrowthInsightType" AS ENUM (
  'HIGH_PERFORMING_TOPIC',
  'HIGH_PERFORMING_FORMAT',
  'LOW_ENGAGEMENT',
  'STRONG_HOOK',
  'WEAK_CTA',
  'POSTING_GAP',
  'BEST_PUBLISHING_WINDOW',
  'AUDIENCE_GROWTH',
  'DECLINING_REACH',
  'VIDEO_RETENTION_DROP',
  'CHANNEL_OPPORTUNITY',
  'REPURPOSING_OPPORTUNITY'
);

CREATE TYPE "BenchmarkType" AS ENUM (
  'PREVIOUS_PERIOD',
  'MOVING_AVERAGE',
  'BRAND_MEDIAN',
  'CHANNEL_MEDIAN',
  'CONTENT_TYPE_MEDIAN',
  'CAMPAIGN_MEDIAN'
);

CREATE TYPE "GrowthConfidenceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "GrowthDataStatus" AS ENUM ('SUFFICIENT', 'INSUFFICIENT');
CREATE TYPE "GrowthRecommendationStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUPERSEDED');

CREATE TYPE "RecommendationFeedbackStatus" AS ENUM (
  'ACCEPTED',
  'DISMISSED',
  'PLANNED',
  'IMPLEMENTED',
  'SUCCESSFUL',
  'UNSUCCESSFUL',
  'INCONCLUSIVE'
);

CREATE TYPE "GrowthExperimentStatus" AS ENUM ('PLANNED', 'RUNNING', 'COMPLETED', 'CANCELLED');

CREATE TYPE "RecommendationDraftType" AS ENUM (
  'CONTENT_IDEA',
  'STUDIO_BRIEF',
  'EXPERIMENT',
  'CALENDAR_PLACEHOLDER'
);

CREATE TABLE "GrowthInsight" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "insightType" "GrowthInsightType" NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "dataStatus" "GrowthDataStatus" NOT NULL DEFAULT 'INSUFFICIENT',
  "confidenceLevel" "GrowthConfidenceLevel" NOT NULL DEFAULT 'LOW',
  "comparedPeriodStart" TIMESTAMP(3),
  "comparedPeriodEnd" TIMESTAMP(3),
  "analysisPeriodStart" TIMESTAMP(3) NOT NULL,
  "analysisPeriodEnd" TIMESTAMP(3) NOT NULL,
  "minimumDataThreshold" JSONB NOT NULL,
  "sourceMetrics" JSONB NOT NULL DEFAULT '{}',
  "supportingContentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "correlationDisclaimer" TEXT NOT NULL DEFAULT 'Patterns reflect correlation with performance, not proven causation.',
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "supersededAt" TIMESTAMP(3),
  "metadata" JSONB,

  CONSTRAINT "GrowthInsight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InsightEvidence" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "growthInsightId" TEXT NOT NULL,
  "evidenceKey" TEXT NOT NULL,
  "evidenceLabel" TEXT,
  "evidenceValue" JSONB NOT NULL,
  "contentItemId" TEXT,
  "contentVariantId" TEXT,
  "providerPostId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InsightEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PerformanceBenchmark" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "benchmarkType" "BenchmarkType" NOT NULL,
  "metricKey" TEXT NOT NULL,
  "segmentKey" TEXT,
  "segmentLabel" TEXT,
  "value" DECIMAL(24,6) NOT NULL,
  "sampleSize" INTEGER NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,

  CONSTRAINT "PerformanceBenchmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentPattern" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "dimension" TEXT NOT NULL,
  "dimensionValue" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "metricValue" DECIMAL(24,6) NOT NULL,
  "sampleSize" INTEGER NOT NULL,
  "correlationNote" TEXT NOT NULL DEFAULT 'Correlation with performance; not proven causation.',
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "supportingContentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,

  CONSTRAINT "ContentPattern_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GrowthRecommendation" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "growthInsightId" TEXT,
  "insightType" "GrowthInsightType",
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 50,
  "status" "GrowthRecommendationStatus" NOT NULL DEFAULT 'ACTIVE',
  "finding" TEXT,
  "explanation" TEXT,
  "recommendedAction" TEXT,
  "evidenceSummary" JSONB NOT NULL DEFAULT '[]',
  "expectedHypothesis" TEXT,
  "measurementPlan" TEXT,
  "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
  "aiRequestId" TEXT,
  "draftContentItemId" TEXT,
  "draftExperimentId" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GrowthRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecommendationOutcome" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "growthRecommendationId" TEXT NOT NULL,
  "userProfileId" TEXT NOT NULL,
  "feedbackStatus" "RecommendationFeedbackStatus" NOT NULL,
  "reason" TEXT,
  "outcomeNotes" TEXT,
  "measuredOutcome" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RecommendationOutcome_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GrowthExperiment" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "growthRecommendationId" TEXT,
  "title" TEXT NOT NULL,
  "hypothesis" TEXT NOT NULL,
  "status" "GrowthExperimentStatus" NOT NULL DEFAULT 'PLANNED',
  "measurementPlan" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "resultSummary" TEXT,
  "linkedContentItemId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GrowthExperiment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GrowthInsight_organisationId_brandId_generatedAt_idx" ON "GrowthInsight"("organisationId", "brandId", "generatedAt");
CREATE INDEX "GrowthInsight_brandId_insightType_idx" ON "GrowthInsight"("brandId", "insightType");
CREATE INDEX "GrowthInsight_dataStatus_idx" ON "GrowthInsight"("dataStatus");
CREATE INDEX "GrowthInsight_expiresAt_idx" ON "GrowthInsight"("expiresAt");

CREATE INDEX "InsightEvidence_growthInsightId_idx" ON "InsightEvidence"("growthInsightId");
CREATE INDEX "InsightEvidence_organisationId_brandId_idx" ON "InsightEvidence"("organisationId", "brandId");
CREATE INDEX "InsightEvidence_contentItemId_idx" ON "InsightEvidence"("contentItemId");

CREATE INDEX "PerformanceBenchmark_organisationId_brandId_benchmarkType_idx" ON "PerformanceBenchmark"("organisationId", "brandId", "benchmarkType");
CREATE INDEX "PerformanceBenchmark_brandId_metricKey_idx" ON "PerformanceBenchmark"("brandId", "metricKey");
CREATE INDEX "PerformanceBenchmark_computedAt_idx" ON "PerformanceBenchmark"("computedAt");

CREATE INDEX "ContentPattern_organisationId_brandId_dimension_idx" ON "ContentPattern"("organisationId", "brandId", "dimension");
CREATE INDEX "ContentPattern_brandId_computedAt_idx" ON "ContentPattern"("brandId", "computedAt");

CREATE INDEX "GrowthRecommendation_organisationId_brandId_status_idx" ON "GrowthRecommendation"("organisationId", "brandId", "status");
CREATE INDEX "GrowthRecommendation_brandId_createdAt_idx" ON "GrowthRecommendation"("brandId", "createdAt");
CREATE INDEX "GrowthRecommendation_growthInsightId_idx" ON "GrowthRecommendation"("growthInsightId");

CREATE INDEX "RecommendationOutcome_growthRecommendationId_idx" ON "RecommendationOutcome"("growthRecommendationId");
CREATE INDEX "RecommendationOutcome_organisationId_brandId_idx" ON "RecommendationOutcome"("organisationId", "brandId");
CREATE INDEX "RecommendationOutcome_feedbackStatus_idx" ON "RecommendationOutcome"("feedbackStatus");

CREATE INDEX "GrowthExperiment_organisationId_brandId_status_idx" ON "GrowthExperiment"("organisationId", "brandId", "status");
CREATE INDEX "GrowthExperiment_growthRecommendationId_idx" ON "GrowthExperiment"("growthRecommendationId");

ALTER TABLE "GrowthInsight" ADD CONSTRAINT "GrowthInsight_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrowthInsight" ADD CONSTRAINT "GrowthInsight_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrowthInsight" ADD CONSTRAINT "GrowthInsight_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InsightEvidence" ADD CONSTRAINT "InsightEvidence_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InsightEvidence" ADD CONSTRAINT "InsightEvidence_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InsightEvidence" ADD CONSTRAINT "InsightEvidence_growthInsightId_fkey" FOREIGN KEY ("growthInsightId") REFERENCES "GrowthInsight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PerformanceBenchmark" ADD CONSTRAINT "PerformanceBenchmark_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceBenchmark" ADD CONSTRAINT "PerformanceBenchmark_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceBenchmark" ADD CONSTRAINT "PerformanceBenchmark_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentPattern" ADD CONSTRAINT "ContentPattern_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentPattern" ADD CONSTRAINT "ContentPattern_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentPattern" ADD CONSTRAINT "ContentPattern_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GrowthRecommendation" ADD CONSTRAINT "GrowthRecommendation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrowthRecommendation" ADD CONSTRAINT "GrowthRecommendation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrowthRecommendation" ADD CONSTRAINT "GrowthRecommendation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrowthRecommendation" ADD CONSTRAINT "GrowthRecommendation_growthInsightId_fkey" FOREIGN KEY ("growthInsightId") REFERENCES "GrowthInsight"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecommendationOutcome" ADD CONSTRAINT "RecommendationOutcome_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationOutcome" ADD CONSTRAINT "RecommendationOutcome_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationOutcome" ADD CONSTRAINT "RecommendationOutcome_growthRecommendationId_fkey" FOREIGN KEY ("growthRecommendationId") REFERENCES "GrowthRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationOutcome" ADD CONSTRAINT "RecommendationOutcome_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GrowthExperiment" ADD CONSTRAINT "GrowthExperiment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrowthExperiment" ADD CONSTRAINT "GrowthExperiment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrowthExperiment" ADD CONSTRAINT "GrowthExperiment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrowthExperiment" ADD CONSTRAINT "GrowthExperiment_growthRecommendationId_fkey" FOREIGN KEY ("growthRecommendationId") REFERENCES "GrowthRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GrowthExperiment" ADD CONSTRAINT "GrowthExperiment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
