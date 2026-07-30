-- Task 5.7: Advertising Experiments and A/B Testing

-- CreateEnum
CREATE TYPE "AdvertisingExperimentStatus" AS ENUM ('DRAFT', 'READY', 'RUNNING', 'PAUSED', 'COMPLETED', 'INCONCLUSIVE', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdvertisingExperimentType" AS ENUM ('CREATIVE', 'HEADLINE', 'COPY', 'CTA', 'AUDIENCE', 'LANDING_PAGE', 'OFFER', 'PLACEMENT', 'BIDDING_STRATEGY', 'BUDGET_ALLOCATION', 'CAMPAIGN_STRUCTURE');

-- CreateEnum
CREATE TYPE "AdvertisingExperimentVariantType" AS ENUM ('CONTROL', 'TREATMENT', 'MULTI_VARIANT');

-- CreateEnum
CREATE TYPE "AdvertisingExperimentAllocationType" AS ENUM ('EQUAL', 'WEIGHTED', 'PROVIDER_NATIVE', 'SEQUENTIAL', 'MANUAL');

-- CreateEnum
CREATE TYPE "AdvertisingExperimentMetricRole" AS ENUM ('PRIMARY', 'GUARDRAIL', 'SECONDARY');

-- CreateEnum
CREATE TYPE "AdvertisingExperimentValiditySeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AdvertisingExperimentDecisionOutcome" AS ENUM ('ADOPT_VARIANT', 'KEEP_CONTROL', 'CONTINUE_TEST', 'RUN_FOLLOWUP', 'INCONCLUSIVE', 'INVALID_TEST', 'STOP_FOR_SAFETY');

-- CreateTable
CREATE TABLE "AdvertisingExperiment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "planId" TEXT,
    "title" TEXT NOT NULL,
    "internalRef" TEXT,
    "status" "AdvertisingExperimentStatus" NOT NULL DEFAULT 'DRAFT',
    "experimentType" "AdvertisingExperimentType" NOT NULL,
    "provider" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "featureFlags" JSONB,
    "riskTier" TEXT NOT NULL DEFAULT 'STANDARD',
    "currentVersionId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingExperimentVersion" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "snapshot" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingExperimentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingExperimentHypothesis" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "observedProblem" TEXT NOT NULL,
    "proposedChange" TEXT NOT NULL,
    "expectedOutcome" TEXT NOT NULL,
    "primaryMetric" TEXT NOT NULL,
    "guardrailMetrics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audience" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "minimumVolume" INTEGER NOT NULL,
    "decisionRule" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingExperimentHypothesis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingExperimentVariant" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "variantType" "AdvertisingExperimentVariantType" NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "documentedVariables" JSONB NOT NULL,
    "providerCampaignId" TEXT,
    "providerAdSetId" TEXT,
    "providerAdId" TEXT,
    "internalCreativeId" TEXT,
    "providerResourceIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingExperimentVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingExperimentAllocation" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "allocationType" "AdvertisingExperimentAllocationType" NOT NULL,
    "weights" JSONB,
    "providerNativeSplit" BOOLEAN NOT NULL DEFAULT false,
    "randomisationDisclaimer" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingExperimentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingExperimentMetric" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "role" "AdvertisingExperimentMetricRole" NOT NULL,
    "label" TEXT,
    "attributionDefinition" TEXT,
    "providerMetricName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingExperimentMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingExperimentObservation" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "rawValue" DECIMAL(24,6) NOT NULL,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "providerAttributionWindow" TEXT,
    "dataSource" TEXT,
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingExperimentObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingExperimentResult" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "absoluteValue" DECIMAL(24,6) NOT NULL,
    "relativeDifference" DECIMAL(24,6),
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "confidenceMethod" TEXT,
    "uncertaintyLower" DECIMAL(24,6),
    "uncertaintyUpper" DECIMAL(24,6),
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingExperimentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingExperimentValidityCheck" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "checkType" TEXT NOT NULL,
    "severity" "AdvertisingExperimentValiditySeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "AdvertisingExperimentValidityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingExperimentDecision" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "outcome" "AdvertisingExperimentDecisionOutcome" NOT NULL,
    "winningVariantId" TEXT,
    "recommendation" TEXT NOT NULL,
    "limitations" TEXT NOT NULL,
    "confidenceNote" TEXT NOT NULL DEFAULT 'Results are observational unless a documented valid statistical method was applied.',
    "decidedByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingExperimentDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvertisingExperiment_organisationId_brandId_status_idx" ON "AdvertisingExperiment"("organisationId", "brandId", "status");

-- CreateIndex
CREATE INDEX "AdvertisingExperiment_experimentType_idx" ON "AdvertisingExperiment"("experimentType");

-- CreateIndex
CREATE INDEX "AdvertisingExperiment_planId_idx" ON "AdvertisingExperiment"("planId");

-- CreateIndex
CREATE INDEX "AdvertisingExperimentVersion_experimentId_idx" ON "AdvertisingExperimentVersion"("experimentId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingExperimentVersion_experimentId_versionNumber_key" ON "AdvertisingExperimentVersion"("experimentId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingExperimentHypothesis_experimentId_key" ON "AdvertisingExperimentHypothesis"("experimentId");

-- CreateIndex
CREATE INDEX "AdvertisingExperimentHypothesis_experimentId_idx" ON "AdvertisingExperimentHypothesis"("experimentId");

-- CreateIndex
CREATE INDEX "AdvertisingExperimentVariant_experimentId_sortOrder_idx" ON "AdvertisingExperimentVariant"("experimentId", "sortOrder");

-- CreateIndex
CREATE INDEX "AdvertisingExperimentAllocation_experimentId_idx" ON "AdvertisingExperimentAllocation"("experimentId");

-- CreateIndex
CREATE INDEX "AdvertisingExperimentMetric_experimentId_role_idx" ON "AdvertisingExperimentMetric"("experimentId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingExperimentMetric_experimentId_metricKey_role_key" ON "AdvertisingExperimentMetric"("experimentId", "metricKey", "role");

-- CreateIndex
CREATE INDEX "AdvertisingExperimentObservation_experimentId_variantId_metricKey_idx" ON "AdvertisingExperimentObservation"("experimentId", "variantId", "metricKey");

-- CreateIndex
CREATE INDEX "AdvertisingExperimentObservation_observedAt_idx" ON "AdvertisingExperimentObservation"("observedAt");

-- CreateIndex
CREATE INDEX "AdvertisingExperimentResult_experimentId_idx" ON "AdvertisingExperimentResult"("experimentId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingExperimentResult_variantId_metricKey_key" ON "AdvertisingExperimentResult"("variantId", "metricKey");

-- CreateIndex
CREATE INDEX "AdvertisingExperimentValidityCheck_experimentId_severity_idx" ON "AdvertisingExperimentValidityCheck"("experimentId", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingExperimentDecision_experimentId_key" ON "AdvertisingExperimentDecision"("experimentId");

-- CreateIndex
CREATE INDEX "AdvertisingExperimentDecision_outcome_idx" ON "AdvertisingExperimentDecision"("outcome");

-- AddForeignKey
ALTER TABLE "AdvertisingExperiment" ADD CONSTRAINT "AdvertisingExperiment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingExperiment" ADD CONSTRAINT "AdvertisingExperiment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingExperiment" ADD CONSTRAINT "AdvertisingExperiment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingExperiment" ADD CONSTRAINT "AdvertisingExperiment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingExperiment" ADD CONSTRAINT "AdvertisingExperiment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingExperimentVersion" ADD CONSTRAINT "AdvertisingExperimentVersion_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "AdvertisingExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingExperimentVersion" ADD CONSTRAINT "AdvertisingExperimentVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingExperimentHypothesis" ADD CONSTRAINT "AdvertisingExperimentHypothesis_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "AdvertisingExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingExperimentVariant" ADD CONSTRAINT "AdvertisingExperimentVariant_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "AdvertisingExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingExperimentAllocation" ADD CONSTRAINT "AdvertisingExperimentAllocation_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "AdvertisingExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingExperimentMetric" ADD CONSTRAINT "AdvertisingExperimentMetric_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "AdvertisingExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingExperimentObservation" ADD CONSTRAINT "AdvertisingExperimentObservation_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "AdvertisingExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingExperimentObservation" ADD CONSTRAINT "AdvertisingExperimentObservation_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "AdvertisingExperimentVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingExperimentResult" ADD CONSTRAINT "AdvertisingExperimentResult_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "AdvertisingExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingExperimentResult" ADD CONSTRAINT "AdvertisingExperimentResult_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "AdvertisingExperimentVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingExperimentValidityCheck" ADD CONSTRAINT "AdvertisingExperimentValidityCheck_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "AdvertisingExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingExperimentDecision" ADD CONSTRAINT "AdvertisingExperimentDecision_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "AdvertisingExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingExperimentDecision" ADD CONSTRAINT "AdvertisingExperimentDecision_winningVariantId_fkey" FOREIGN KEY ("winningVariantId") REFERENCES "AdvertisingExperimentVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingExperimentDecision" ADD CONSTRAINT "AdvertisingExperimentDecision_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingExperimentDecision" ADD CONSTRAINT "AdvertisingExperimentDecision_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
