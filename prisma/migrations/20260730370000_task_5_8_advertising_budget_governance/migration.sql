-- Task 5.8: Budget Pacing and Advertising Spend Governance

-- CreateEnum
CREATE TYPE "AdvertisingBudgetLimitLevel" AS ENUM ('ORGANISATION', 'PROJECT', 'BRAND', 'PROVIDER', 'ACCOUNT', 'CAMPAIGN', 'EXPERIMENT', 'DAY', 'WEEK', 'MONTH', 'BILLING_CYCLE');

-- CreateEnum
CREATE TYPE "AdvertisingBudgetPeriodType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'BILLING_CYCLE', 'LIFETIME');

-- CreateEnum
CREATE TYPE "AdvertisingBudgetAlertType" AS ENUM ('SPEND_SPIKE', 'OVERSPEND_RISK', 'BUDGET_EXHAUSTED', 'SPEND_AFTER_END_DATE', 'SPEND_WITHOUT_TRACKING', 'SPEND_WITHOUT_CONVERSIONS', 'CURRENCY_MISMATCH', 'PROVIDER_DATA_STALE', 'DAILY_CHANGE_ABOVE_POLICY', 'UNEXPECTED_PROVIDER_BUDGET_CHANGE');

-- CreateEnum
CREATE TYPE "AdvertisingBudgetAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AdvertisingBudgetChangeRequestType" AS ENUM ('INCREASE_BUDGET', 'DECREASE_BUDGET', 'MOVE_BUDGET', 'EXTEND_SCHEDULE', 'PAUSE_CAMPAIGN', 'RESUME_CAMPAIGN');

-- CreateEnum
CREATE TYPE "AdvertisingBudgetChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'AUTO_REJECTED');

-- CreateEnum
CREATE TYPE "AdvertisingSpendIncidentType" AS ENUM ('EMERGENCY_PAUSE', 'PROVIDER_MUTATION_SHUTDOWN', 'ORGANISATION_FREEZE', 'ACCOUNT_FREEZE', 'OVERSPEND', 'POLICY_VIOLATION');

-- CreateEnum
CREATE TYPE "AdvertisingSpendIncidentStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'ESCALATED');

-- CreateTable
CREATE TABLE "AdvertisingBudgetPolicy" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "marketerCanRequest" BOOLEAN NOT NULL DEFAULT true,
    "adminApprovalThresholdPct" DECIMAL(8,2) NOT NULL DEFAULT 10,
    "ownerApprovalThresholdPct" DECIMAL(8,2) NOT NULL DEFAULT 25,
    "hardLimitPct" DECIMAL(8,2) NOT NULL DEFAULT 50,
    "clientApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
    "dailyChangeLimitPct" DECIMAL(8,2) NOT NULL DEFAULT 20,
    "emergencyPauseEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiRecommendationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingBudgetPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingBudgetLimit" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "policyId" TEXT,
    "limitLevel" "AdvertisingBudgetLimitLevel" NOT NULL,
    "scopeId" TEXT,
    "provider" TEXT,
    "periodType" "AdvertisingBudgetPeriodType" NOT NULL,
    "currency" TEXT NOT NULL,
    "limitAmount" DECIMAL(24,6) NOT NULL,
    "hardCap" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingBudgetLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingBudgetAllocation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "provider" TEXT,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT,
    "currency" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(24,6) NOT NULL,
    "spentAmount" DECIMAL(24,6) NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingBudgetAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingSpendObservation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "provider" TEXT NOT NULL,
    "accountId" TEXT,
    "campaignId" TEXT,
    "experimentId" TEXT,
    "currency" TEXT NOT NULL,
    "spendAmount" DECIMAL(24,6) NOT NULL,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "conversions" INTEGER,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "dataSource" TEXT NOT NULL DEFAULT 'provider_reporting',
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "hasTracking" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingSpendObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingPacingSnapshot" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "provider" TEXT,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT,
    "currency" TEXT NOT NULL,
    "reportingCurrency" TEXT,
    "fxRate" DECIMAL(18,8),
    "fxRateDate" TIMESTAMP(3),
    "fxRateSource" TEXT,
    "fxRateMissing" BOOLEAN NOT NULL DEFAULT false,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "elapsedTimePct" DECIMAL(8,4) NOT NULL,
    "totalBudget" DECIMAL(24,6) NOT NULL,
    "elapsedBudgetPct" DECIMAL(8,4) NOT NULL,
    "expectedSpend" DECIMAL(24,6) NOT NULL,
    "actualSpend" DECIMAL(24,6) NOT NULL,
    "spendVariance" DECIMAL(24,6) NOT NULL,
    "projectedSpend" DECIMAL(24,6) NOT NULL,
    "remainingBudget" DECIMAL(24,6) NOT NULL,
    "requiredDailyPace" DECIMAL(24,6) NOT NULL,
    "overspendRisk" BOOLEAN NOT NULL DEFAULT false,
    "underspendRisk" BOOLEAN NOT NULL DEFAULT false,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingPacingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingBudgetAlert" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "alertType" "AdvertisingBudgetAlertType" NOT NULL,
    "severity" "AdvertisingBudgetAlertSeverity" NOT NULL DEFAULT 'WARNING',
    "message" TEXT NOT NULL,
    "provider" TEXT,
    "scopeType" TEXT,
    "scopeId" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingBudgetAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingBudgetChangeRequest" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "policyId" TEXT,
    "requestType" "AdvertisingBudgetChangeRequestType" NOT NULL,
    "status" "AdvertisingBudgetChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "evidence" TEXT,
    "provider" TEXT,
    "scopeType" TEXT,
    "scopeId" TEXT,
    "currency" TEXT NOT NULL,
    "currentBudget" DECIMAL(24,6) NOT NULL,
    "proposedBudget" DECIMAL(24,6) NOT NULL,
    "percentageChange" DECIMAL(8,2) NOT NULL,
    "projectedImpact" TEXT,
    "risk" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingBudgetChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingBudgetApproval" (
    "id" TEXT NOT NULL,
    "changeRequestId" TEXT NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingBudgetApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingSpendIncident" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "incidentType" "AdvertisingSpendIncidentType" NOT NULL,
    "status" "AdvertisingSpendIncidentStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "provider" TEXT,
    "scopeType" TEXT,
    "scopeId" TEXT,
    "providerMutationShutdown" BOOLEAN NOT NULL DEFAULT false,
    "restorationRequiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingSpendIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvertisingBudgetPolicy_organisationId_brandId_idx" ON "AdvertisingBudgetPolicy"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "AdvertisingBudgetLimit_organisationId_limitLevel_scopeId_idx" ON "AdvertisingBudgetLimit"("organisationId", "limitLevel", "scopeId");

-- CreateIndex
CREATE INDEX "AdvertisingBudgetLimit_provider_idx" ON "AdvertisingBudgetLimit"("provider");

-- CreateIndex
CREATE INDEX "AdvertisingBudgetAllocation_organisationId_brandId_provider_idx" ON "AdvertisingBudgetAllocation"("organisationId", "brandId", "provider");

-- CreateIndex
CREATE INDEX "AdvertisingBudgetAllocation_periodStart_periodEnd_idx" ON "AdvertisingBudgetAllocation"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "AdvertisingSpendObservation_organisationId_brandId_provider_observedAt_idx" ON "AdvertisingSpendObservation"("organisationId", "brandId", "provider", "observedAt");

-- CreateIndex
CREATE INDEX "AdvertisingSpendObservation_campaignId_idx" ON "AdvertisingSpendObservation"("campaignId");

-- CreateIndex
CREATE INDEX "AdvertisingPacingSnapshot_organisationId_brandId_computedAt_idx" ON "AdvertisingPacingSnapshot"("organisationId", "brandId", "computedAt");

-- CreateIndex
CREATE INDEX "AdvertisingPacingSnapshot_scopeType_scopeId_idx" ON "AdvertisingPacingSnapshot"("scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "AdvertisingBudgetAlert_organisationId_brandId_alertType_idx" ON "AdvertisingBudgetAlert"("organisationId", "brandId", "alertType");

-- CreateIndex
CREATE INDEX "AdvertisingBudgetAlert_acknowledged_createdAt_idx" ON "AdvertisingBudgetAlert"("acknowledged", "createdAt");

-- CreateIndex
CREATE INDEX "AdvertisingBudgetChangeRequest_organisationId_brandId_status_idx" ON "AdvertisingBudgetChangeRequest"("organisationId", "brandId", "status");

-- CreateIndex
CREATE INDEX "AdvertisingBudgetChangeRequest_requestType_idx" ON "AdvertisingBudgetChangeRequest"("requestType");

-- CreateIndex
CREATE INDEX "AdvertisingBudgetApproval_changeRequestId_idx" ON "AdvertisingBudgetApproval"("changeRequestId");

-- CreateIndex
CREATE INDEX "AdvertisingSpendIncident_organisationId_status_idx" ON "AdvertisingSpendIncident"("organisationId", "status");

-- CreateIndex
CREATE INDEX "AdvertisingSpendIncident_incidentType_idx" ON "AdvertisingSpendIncident"("incidentType");

-- AddForeignKey
ALTER TABLE "AdvertisingBudgetPolicy" ADD CONSTRAINT "AdvertisingBudgetPolicy_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingBudgetPolicy" ADD CONSTRAINT "AdvertisingBudgetPolicy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingBudgetPolicy" ADD CONSTRAINT "AdvertisingBudgetPolicy_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingBudgetPolicy" ADD CONSTRAINT "AdvertisingBudgetPolicy_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingBudgetLimit" ADD CONSTRAINT "AdvertisingBudgetLimit_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingBudgetLimit" ADD CONSTRAINT "AdvertisingBudgetLimit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingBudgetLimit" ADD CONSTRAINT "AdvertisingBudgetLimit_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingBudgetLimit" ADD CONSTRAINT "AdvertisingBudgetLimit_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "AdvertisingBudgetPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingBudgetAllocation" ADD CONSTRAINT "AdvertisingBudgetAllocation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingBudgetAllocation" ADD CONSTRAINT "AdvertisingBudgetAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingBudgetAllocation" ADD CONSTRAINT "AdvertisingBudgetAllocation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingSpendObservation" ADD CONSTRAINT "AdvertisingSpendObservation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingSpendObservation" ADD CONSTRAINT "AdvertisingSpendObservation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingSpendObservation" ADD CONSTRAINT "AdvertisingSpendObservation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingPacingSnapshot" ADD CONSTRAINT "AdvertisingPacingSnapshot_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingPacingSnapshot" ADD CONSTRAINT "AdvertisingPacingSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingPacingSnapshot" ADD CONSTRAINT "AdvertisingPacingSnapshot_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingBudgetAlert" ADD CONSTRAINT "AdvertisingBudgetAlert_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingBudgetAlert" ADD CONSTRAINT "AdvertisingBudgetAlert_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingBudgetAlert" ADD CONSTRAINT "AdvertisingBudgetAlert_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingBudgetChangeRequest" ADD CONSTRAINT "AdvertisingBudgetChangeRequest_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingBudgetChangeRequest" ADD CONSTRAINT "AdvertisingBudgetChangeRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingBudgetChangeRequest" ADD CONSTRAINT "AdvertisingBudgetChangeRequest_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingBudgetChangeRequest" ADD CONSTRAINT "AdvertisingBudgetChangeRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingBudgetApproval" ADD CONSTRAINT "AdvertisingBudgetApproval_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "AdvertisingBudgetChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingBudgetApproval" ADD CONSTRAINT "AdvertisingBudgetApproval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingSpendIncident" ADD CONSTRAINT "AdvertisingSpendIncident_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingSpendIncident" ADD CONSTRAINT "AdvertisingSpendIncident_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingSpendIncident" ADD CONSTRAINT "AdvertisingSpendIncident_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingSpendIncident" ADD CONSTRAINT "AdvertisingSpendIncident_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
