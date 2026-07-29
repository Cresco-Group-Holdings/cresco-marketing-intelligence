-- Task 2.16 — Social content experiments

CREATE TYPE "SocialExperimentStatus" AS ENUM (
  'DRAFT',
  'READY',
  'RUNNING',
  'COMPLETED',
  'CANCELLED',
  'INCONCLUSIVE'
);

CREATE TYPE "SocialExperimentTestType" AS ENUM (
  'HOOK',
  'CAPTION',
  'CTA',
  'VISUAL',
  'VIDEO_DURATION',
  'COVER',
  'CONTENT_FORMAT',
  'PUBLISHING_TIME',
  'CONTENT_PILLAR'
);

CREATE TYPE "SocialExperimentMode" AS ENUM (
  'OBSERVATIONAL',
  'SCHEDULED'
);

CREATE TYPE "ExperimentMetricRole" AS ENUM (
  'PRIMARY',
  'SECONDARY'
);

CREATE TYPE "ExperimentDecisionOutcome" AS ENUM (
  'WINNER',
  'LOSER',
  'INCONCLUSIVE',
  'NONE'
);

CREATE TYPE "ExperimentReuseType" AS ENUM (
  'CONTENT_PATTERN',
  'GROWTH_RECOMMENDATION',
  'BRAND_MESSAGING_NOTE',
  'CONTENT_STUDIO_GUIDANCE'
);

CREATE TABLE "SocialExperiment" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "SocialExperimentStatus" NOT NULL DEFAULT 'DRAFT',
  "testType" "SocialExperimentTestType" NOT NULL,
  "mode" "SocialExperimentMode" NOT NULL DEFAULT 'OBSERVATIONAL',
  "targetProvider" "SocialProvider" NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "minimumSampleThreshold" INTEGER NOT NULL,
  "decisionRule" TEXT NOT NULL,
  "confoundingFactorNotes" TEXT,
  "validityWarnings" JSONB NOT NULL DEFAULT '[]',
  "observationalDisclaimer" TEXT NOT NULL DEFAULT 'Observational comparison only. This is not a randomised controlled trial and platforms do not deliver content to equivalent audiences.',
  "createdByUserId" TEXT NOT NULL,
  "cancelledAt" TIMESTAMP(3),
  "cancelledReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SocialExperiment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExperimentHypothesis" (
  "id" TEXT NOT NULL,
  "socialExperimentId" TEXT NOT NULL,
  "statement" TEXT NOT NULL,
  "expectedDirection" TEXT,
  "rationale" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExperimentHypothesis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExperimentVariant" (
  "id" TEXT NOT NULL,
  "socialExperimentId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "contentItemId" TEXT,
  "contentVariantId" TEXT,
  "provider" "SocialProvider",
  "scheduledFor" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "hasPaidPromotion" BOOLEAN NOT NULL DEFAULT false,
  "contentTopic" TEXT,
  "hookText" TEXT,
  "captionText" TEXT,
  "ctaText" TEXT,
  "contentPillar" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExperimentVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExperimentMetric" (
  "id" TEXT NOT NULL,
  "socialExperimentId" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "role" "ExperimentMetricRole" NOT NULL,
  "label" TEXT,
  "normalisationMethod" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExperimentMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExperimentResult" (
  "id" TEXT NOT NULL,
  "socialExperimentId" TEXT NOT NULL,
  "experimentVariantId" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "rawValue" DECIMAL(24,6) NOT NULL,
  "normalisedValue" DECIMAL(24,6),
  "sampleSize" INTEGER NOT NULL DEFAULT 0,
  "dataSufficient" BOOLEAN NOT NULL DEFAULT false,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExperimentResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExperimentDecision" (
  "id" TEXT NOT NULL,
  "socialExperimentId" TEXT NOT NULL,
  "outcome" "ExperimentDecisionOutcome" NOT NULL,
  "winningVariantId" TEXT,
  "absoluteDifference" DECIMAL(24,6),
  "percentageDifference" DECIMAL(24,6),
  "limitations" TEXT NOT NULL,
  "confidenceNote" TEXT NOT NULL DEFAULT 'Observational comparison only; not a randomised controlled trial.',
  "decidedByUserId" TEXT NOT NULL,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExperimentDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExperimentReuseRecord" (
  "id" TEXT NOT NULL,
  "socialExperimentId" TEXT NOT NULL,
  "reuseType" "ExperimentReuseType" NOT NULL,
  "targetResourceType" TEXT NOT NULL,
  "targetResourceId" TEXT NOT NULL,
  "summary" TEXT,
  "confirmedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExperimentReuseRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExperimentHypothesis_socialExperimentId_key" ON "ExperimentHypothesis"("socialExperimentId");
CREATE INDEX "SocialExperiment_organisationId_brandId_status_idx" ON "SocialExperiment"("organisationId", "brandId", "status");
CREATE INDEX "SocialExperiment_brandId_startDate_idx" ON "SocialExperiment"("brandId", "startDate");
CREATE INDEX "SocialExperiment_testType_idx" ON "SocialExperiment"("testType");
CREATE INDEX "ExperimentVariant_socialExperimentId_sortOrder_idx" ON "ExperimentVariant"("socialExperimentId", "sortOrder");
CREATE INDEX "ExperimentVariant_contentItemId_idx" ON "ExperimentVariant"("contentItemId");
CREATE UNIQUE INDEX "ExperimentMetric_socialExperimentId_metricKey_role_key" ON "ExperimentMetric"("socialExperimentId", "metricKey", "role");
CREATE INDEX "ExperimentMetric_socialExperimentId_role_idx" ON "ExperimentMetric"("socialExperimentId", "role");
CREATE UNIQUE INDEX "ExperimentResult_experimentVariantId_metricKey_key" ON "ExperimentResult"("experimentVariantId", "metricKey");
CREATE INDEX "ExperimentResult_socialExperimentId_idx" ON "ExperimentResult"("socialExperimentId");
CREATE UNIQUE INDEX "ExperimentDecision_socialExperimentId_key" ON "ExperimentDecision"("socialExperimentId");
CREATE INDEX "ExperimentDecision_outcome_idx" ON "ExperimentDecision"("outcome");
CREATE INDEX "ExperimentReuseRecord_socialExperimentId_reuseType_idx" ON "ExperimentReuseRecord"("socialExperimentId", "reuseType");

ALTER TABLE "SocialExperiment" ADD CONSTRAINT "SocialExperiment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialExperiment" ADD CONSTRAINT "SocialExperiment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialExperiment" ADD CONSTRAINT "SocialExperiment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialExperiment" ADD CONSTRAINT "SocialExperiment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExperimentHypothesis" ADD CONSTRAINT "ExperimentHypothesis_socialExperimentId_fkey" FOREIGN KEY ("socialExperimentId") REFERENCES "SocialExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExperimentVariant" ADD CONSTRAINT "ExperimentVariant_socialExperimentId_fkey" FOREIGN KEY ("socialExperimentId") REFERENCES "SocialExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperimentVariant" ADD CONSTRAINT "ExperimentVariant_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExperimentVariant" ADD CONSTRAINT "ExperimentVariant_contentVariantId_fkey" FOREIGN KEY ("contentVariantId") REFERENCES "ContentVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExperimentMetric" ADD CONSTRAINT "ExperimentMetric_socialExperimentId_fkey" FOREIGN KEY ("socialExperimentId") REFERENCES "SocialExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExperimentResult" ADD CONSTRAINT "ExperimentResult_socialExperimentId_fkey" FOREIGN KEY ("socialExperimentId") REFERENCES "SocialExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperimentResult" ADD CONSTRAINT "ExperimentResult_experimentVariantId_fkey" FOREIGN KEY ("experimentVariantId") REFERENCES "ExperimentVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExperimentDecision" ADD CONSTRAINT "ExperimentDecision_socialExperimentId_fkey" FOREIGN KEY ("socialExperimentId") REFERENCES "SocialExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperimentDecision" ADD CONSTRAINT "ExperimentDecision_winningVariantId_fkey" FOREIGN KEY ("winningVariantId") REFERENCES "ExperimentVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExperimentDecision" ADD CONSTRAINT "ExperimentDecision_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExperimentReuseRecord" ADD CONSTRAINT "ExperimentReuseRecord_socialExperimentId_fkey" FOREIGN KEY ("socialExperimentId") REFERENCES "SocialExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperimentReuseRecord" ADD CONSTRAINT "ExperimentReuseRecord_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
