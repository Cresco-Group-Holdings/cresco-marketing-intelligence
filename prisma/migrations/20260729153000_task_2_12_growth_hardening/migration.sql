-- Task 2.12 hardening: atomic analysis runs, idempotency, lifecycle fields

CREATE TYPE "GrowthAnalysisRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "GrowthAnalysisRun" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "analysisPeriodStart" TIMESTAMP(3) NOT NULL,
  "analysisPeriodEnd" TIMESTAMP(3) NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" "GrowthAnalysisRunStatus" NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "postCount" INTEGER NOT NULL DEFAULT 0,
  "insightCount" INTEGER NOT NULL DEFAULT 0,
  "recommendationCount" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "GrowthAnalysisRun_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GrowthInsight" ADD COLUMN "analysisRunId" TEXT;
ALTER TABLE "GrowthInsight" ADD COLUMN "idempotencyKey" TEXT;

UPDATE "GrowthInsight"
SET "idempotencyKey" = "brandId" || ':' || "analysisPeriodStart"::text || ':' || "analysisPeriodEnd"::text || ':' || "insightType"::text
WHERE "idempotencyKey" IS NULL;

ALTER TABLE "GrowthInsight" ALTER COLUMN "idempotencyKey" SET NOT NULL;

ALTER TABLE "GrowthRecommendation" ADD COLUMN "analysisRunId" TEXT;
ALTER TABLE "GrowthRecommendation" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "GrowthRecommendation" ADD COLUMN "analysisPeriodStart" TIMESTAMP(3);
ALTER TABLE "GrowthRecommendation" ADD COLUMN "analysisPeriodEnd" TIMESTAMP(3);
ALTER TABLE "GrowthRecommendation" ADD COLUMN "explanationSource" TEXT;
ALTER TABLE "GrowthRecommendation" ADD COLUMN "latestFeedbackStatus" "RecommendationFeedbackStatus";
ALTER TABLE "GrowthRecommendation" ADD COLUMN "latestOutcomeId" TEXT;

UPDATE "GrowthRecommendation" gr
SET
  "idempotencyKey" = gr."brandId" || ':' || COALESCE(gr."analysisPeriodStart", gi."analysisPeriodStart")::text || ':' || COALESCE(gr."analysisPeriodEnd", gi."analysisPeriodEnd")::text || ':' || gr."insightType"::text,
  "analysisPeriodStart" = COALESCE(gr."analysisPeriodStart", gi."analysisPeriodStart"),
  "analysisPeriodEnd" = COALESCE(gr."analysisPeriodEnd", gi."analysisPeriodEnd")
FROM "GrowthInsight" gi
WHERE gr."growthInsightId" = gi."id"
  AND gr."insightType" IS NOT NULL;

ALTER TABLE "RecommendationOutcome" ADD COLUMN "linkedExperimentId" TEXT;
ALTER TABLE "RecommendationOutcome" ADD COLUMN "isEffective" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "GrowthAnalysisRun_organisationId_brandId_status_idx" ON "GrowthAnalysisRun"("organisationId", "brandId", "status");
CREATE INDEX "GrowthAnalysisRun_completedAt_idx" ON "GrowthAnalysisRun"("completedAt");
CREATE UNIQUE INDEX "GrowthAnalysisRun_brandId_idempotencyKey_key" ON "GrowthAnalysisRun"("brandId", "idempotencyKey");

CREATE INDEX "GrowthInsight_brandId_idempotencyKey_idx" ON "GrowthInsight"("brandId", "idempotencyKey");
CREATE INDEX "GrowthInsight_analysisRunId_idx" ON "GrowthInsight"("analysisRunId");
CREATE UNIQUE INDEX "GrowthInsight_active_idempotency_key" ON "GrowthInsight"("brandId", "idempotencyKey") WHERE "supersededAt" IS NULL;

CREATE INDEX "GrowthRecommendation_brandId_idempotencyKey_idx" ON "GrowthRecommendation"("brandId", "idempotencyKey");
CREATE INDEX "GrowthRecommendation_analysisRunId_idx" ON "GrowthRecommendation"("analysisRunId");
CREATE UNIQUE INDEX "GrowthRecommendation_active_window_insight_type" ON "GrowthRecommendation"("brandId", "insightType", "analysisPeriodStart", "analysisPeriodEnd") WHERE "status" = 'ACTIVE' AND "insightType" IS NOT NULL;

CREATE INDEX "RecommendationOutcome_growthRecommendationId_isEffective_idx" ON "RecommendationOutcome"("growthRecommendationId", "isEffective");

ALTER TABLE "GrowthAnalysisRun" ADD CONSTRAINT "GrowthAnalysisRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrowthAnalysisRun" ADD CONSTRAINT "GrowthAnalysisRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrowthAnalysisRun" ADD CONSTRAINT "GrowthAnalysisRun_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GrowthInsight" ADD CONSTRAINT "GrowthInsight_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "GrowthAnalysisRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GrowthRecommendation" ADD CONSTRAINT "GrowthRecommendation_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "GrowthAnalysisRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
