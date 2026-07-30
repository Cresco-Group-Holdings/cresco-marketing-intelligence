-- Task 5.9: AI Advertising Optimisation Agent

-- CreateEnum
CREATE TYPE "AdvertisingOptimisationReviewType" AS ENUM ('DAILY_OPERATIONAL', 'WEEKLY_OPTIMISATION', 'MONTHLY_PORTFOLIO', 'ON_DEMAND_CAMPAIGN');

-- CreateEnum
CREATE TYPE "AdvertisingOptimisationRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdvertisingOptimisationFindingType" AS ENUM ('HIGH_SPEND_LOW_RETURN', 'TRACKING_FAILURE', 'CREATIVE_FATIGUE', 'AUDIENCE_SATURATION', 'LOW_CTR', 'HIGH_CPC', 'HIGH_CPA', 'LOW_CONVERSION_RATE', 'LANDING_PAGE_MISMATCH', 'STRONG_CAMPAIGN', 'STRONG_CREATIVE', 'BUDGET_CONSTRAINT', 'BUDGET_OVERRUN_RISK', 'INVALID_EXPERIMENT', 'PROVIDER_DATA_STALE', 'ATTRIBUTION_GAP', 'POLICY_RISK', 'OTHER');

-- CreateEnum
CREATE TYPE "AdvertisingOptimisationRecommendationType" AS ENUM ('INVESTIGATE_TRACKING', 'PAUSE_FOR_REVIEW', 'REDUCE_BUDGET', 'REQUEST_BUDGET_INCREASE', 'CREATE_NEW_CREATIVE', 'ROTATE_CREATIVE', 'REVISE_AUDIENCE', 'EXCLUDE_LOW_QUALITY_PLACEMENT', 'REVIEW_LANDING_PAGE', 'CREATE_EXPERIMENT', 'CHANGE_SCHEDULE', 'REVIEW_BID_STRATEGY', 'IMPROVE_CONVERSION_TRACKING', 'WAIT_FOR_MORE_DATA');

-- CreateEnum
CREATE TYPE "AdvertisingOptimisationActionClass" AS ENUM ('INFORMATION_ONLY', 'CREATE_TASK', 'CREATE_EXPERIMENT', 'CREATE_CREATIVE_REQUEST', 'REQUEST_BUDGET_CHANGE', 'REQUEST_PAUSE', 'REQUEST_RESUME', 'REQUEST_PROVIDER_CHANGE');

-- CreateEnum
CREATE TYPE "AdvertisingOptimisationConfidenceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AdvertisingOptimisationSampleSizeState" AS ENUM ('INSUFFICIENT', 'MARGINAL', 'SUFFICIENT');

-- CreateEnum
CREATE TYPE "AdvertisingOptimisationDataQualityState" AS ENUM ('POOR', 'FAIR', 'GOOD');

-- CreateEnum
CREATE TYPE "AdvertisingOptimisationActionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'BLOCKED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "AdvertisingOptimisationApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "AdvertisingOptimisationFeedbackStatus" AS ENUM ('ACCEPTED', 'REJECTED', 'DEFERRED', 'IMPLEMENTED', 'OUTCOME_MEASURED', 'OUTCOME_UNAVAILABLE');

-- CreateEnum
CREATE TYPE "AdvertisingOptimisationOutcomeStatus" AS ENUM ('PENDING', 'MEASURED', 'UNAVAILABLE');

-- CreateTable
CREATE TABLE "AdvertisingOptimisationRun" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "reviewType" "AdvertisingOptimisationReviewType" NOT NULL,
    "status" "AdvertisingOptimisationRunStatus" NOT NULL DEFAULT 'PENDING',
    "dateRangeStart" TIMESTAMP(3) NOT NULL,
    "dateRangeEnd" TIMESTAMP(3) NOT NULL,
    "comparisonPeriodStart" TIMESTAMP(3),
    "comparisonPeriodEnd" TIMESTAMP(3),
    "provider" TEXT,
    "accountId" TEXT,
    "campaignId" TEXT,
    "summary" TEXT,
    "guardrailWarnings" JSONB,
    "initiatedByUserId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingOptimisationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingOptimisationEvidence" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "dateRangeStart" TIMESTAMP(3) NOT NULL,
    "dateRangeEnd" TIMESTAMP(3) NOT NULL,
    "comparisonPeriodStart" TIMESTAMP(3),
    "comparisonPeriodEnd" TIMESTAMP(3),
    "provider" TEXT,
    "accountId" TEXT,
    "campaignId" TEXT,
    "metrics" JSONB NOT NULL,
    "metricDefinitions" JSONB NOT NULL,
    "currency" TEXT NOT NULL,
    "attributionModel" TEXT NOT NULL,
    "freshnessHours" DECIMAL(8,2),
    "qualityWarnings" JSONB,
    "minimumVolume" INTEGER NOT NULL,
    "minimumVolumeMet" BOOLEAN NOT NULL DEFAULT false,
    "activeExperimentStatus" JSONB,
    "recentMaterialChanges" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingOptimisationEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingOptimisationFinding" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "findingType" "AdvertisingOptimisationFindingType" NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "provider" TEXT,
    "accountId" TEXT,
    "campaignId" TEXT,
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "suppressionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingOptimisationFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingOptimisationRecommendation" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "findingId" TEXT,
    "recommendationType" "AdvertisingOptimisationRecommendationType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "confidenceLevel" "AdvertisingOptimisationConfidenceLevel" NOT NULL DEFAULT 'MEDIUM',
    "evidenceStrength" TEXT,
    "sampleSizeState" "AdvertisingOptimisationSampleSizeState" NOT NULL DEFAULT 'INSUFFICIENT',
    "dataQualityState" "AdvertisingOptimisationDataQualityState" NOT NULL DEFAULT 'FAIR',
    "alternativeExplanations" JSONB,
    "risk" TEXT,
    "missingData" JSONB,
    "budgetImpact" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "measurementPlan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingOptimisationRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingOptimisationActionProposal" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "actionClass" "AdvertisingOptimisationActionClass" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "payload" JSONB,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "status" "AdvertisingOptimisationActionStatus" NOT NULL DEFAULT 'PENDING',
    "blockedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingOptimisationActionProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingOptimisationApproval" (
    "id" TEXT NOT NULL,
    "actionProposalId" TEXT NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "decision" "AdvertisingOptimisationApprovalDecision" NOT NULL,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingOptimisationApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingOptimisationOutcome" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "actionProposalId" TEXT,
    "outcomeStatus" "AdvertisingOptimisationOutcomeStatus" NOT NULL DEFAULT 'PENDING',
    "preMetrics" JSONB,
    "postMetrics" JSONB,
    "measuredAt" TIMESTAMP(3),
    "successClaimed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingOptimisationOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingOptimisationFeedback" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AdvertisingOptimisationFeedbackStatus" NOT NULL,
    "userExplanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingOptimisationFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingOptimisationEvidence_runId_key" ON "AdvertisingOptimisationEvidence"("runId");

-- CreateIndex
CREATE INDEX "AdvertisingOptimisationRun_organisationId_brandId_reviewType_idx" ON "AdvertisingOptimisationRun"("organisationId", "brandId", "reviewType");

-- CreateIndex
CREATE INDEX "AdvertisingOptimisationRun_status_createdAt_idx" ON "AdvertisingOptimisationRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AdvertisingOptimisationFinding_runId_findingType_idx" ON "AdvertisingOptimisationFinding"("runId", "findingType");

-- CreateIndex
CREATE INDEX "AdvertisingOptimisationRecommendation_runId_recommendationType_idx" ON "AdvertisingOptimisationRecommendation"("runId", "recommendationType");

-- CreateIndex
CREATE INDEX "AdvertisingOptimisationActionProposal_recommendationId_actionClass_idx" ON "AdvertisingOptimisationActionProposal"("recommendationId", "actionClass");

-- CreateIndex
CREATE INDEX "AdvertisingOptimisationActionProposal_status_idx" ON "AdvertisingOptimisationActionProposal"("status");

-- CreateIndex
CREATE INDEX "AdvertisingOptimisationApproval_actionProposalId_idx" ON "AdvertisingOptimisationApproval"("actionProposalId");

-- CreateIndex
CREATE INDEX "AdvertisingOptimisationOutcome_recommendationId_idx" ON "AdvertisingOptimisationOutcome"("recommendationId");

-- CreateIndex
CREATE INDEX "AdvertisingOptimisationFeedback_recommendationId_status_idx" ON "AdvertisingOptimisationFeedback"("recommendationId", "status");

-- AddForeignKey
ALTER TABLE "AdvertisingOptimisationRun" ADD CONSTRAINT "AdvertisingOptimisationRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingOptimisationRun" ADD CONSTRAINT "AdvertisingOptimisationRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingOptimisationRun" ADD CONSTRAINT "AdvertisingOptimisationRun_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingOptimisationRun" ADD CONSTRAINT "AdvertisingOptimisationRun_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingOptimisationEvidence" ADD CONSTRAINT "AdvertisingOptimisationEvidence_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AdvertisingOptimisationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingOptimisationFinding" ADD CONSTRAINT "AdvertisingOptimisationFinding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AdvertisingOptimisationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingOptimisationRecommendation" ADD CONSTRAINT "AdvertisingOptimisationRecommendation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AdvertisingOptimisationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingOptimisationRecommendation" ADD CONSTRAINT "AdvertisingOptimisationRecommendation_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AdvertisingOptimisationFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingOptimisationActionProposal" ADD CONSTRAINT "AdvertisingOptimisationActionProposal_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "AdvertisingOptimisationRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingOptimisationApproval" ADD CONSTRAINT "AdvertisingOptimisationApproval_actionProposalId_fkey" FOREIGN KEY ("actionProposalId") REFERENCES "AdvertisingOptimisationActionProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingOptimisationApproval" ADD CONSTRAINT "AdvertisingOptimisationApproval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingOptimisationOutcome" ADD CONSTRAINT "AdvertisingOptimisationOutcome_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "AdvertisingOptimisationRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingOptimisationOutcome" ADD CONSTRAINT "AdvertisingOptimisationOutcome_actionProposalId_fkey" FOREIGN KEY ("actionProposalId") REFERENCES "AdvertisingOptimisationActionProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingOptimisationFeedback" ADD CONSTRAINT "AdvertisingOptimisationFeedback_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "AdvertisingOptimisationRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingOptimisationFeedback" ADD CONSTRAINT "AdvertisingOptimisationFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
