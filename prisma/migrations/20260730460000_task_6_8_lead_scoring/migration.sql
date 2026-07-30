-- Task 6.8: Lead Scoring

-- CreateEnum
CREATE TYPE "LeadScoringModelStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LeadScoreType" AS ENUM ('FIT_SCORE', 'ENGAGEMENT_SCORE', 'INTENT_SCORE', 'RELATIONSHIP_SCORE', 'PRODUCT_READINESS_SCORE', 'RISK_SCORE', 'COMBINED_SCORE');

-- CreateEnum
CREATE TYPE "LeadScoringSignalCategory" AS ENUM ('FIT', 'ENGAGEMENT', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "LeadScoringRuleOperator" AS ENUM ('EQ', 'NE', 'IN', 'NOT_IN', 'GT', 'GTE', 'LT', 'LTE', 'EXISTS', 'CONTAINS');

-- CreateEnum
CREATE TYPE "LeadScoringDecayType" AS ENUM ('NONE', 'LINEAR', 'EXPONENTIAL');

-- CreateEnum
CREATE TYPE "LeadScoringQualificationStatus" AS ENUM ('UNREVIEWED', 'LOW_PRIORITY', 'MARKETING_QUALIFIED', 'SALES_REVIEW_REQUIRED', 'SALES_QUALIFIED', 'NOT_QUALIFIED', 'CUSTOMER', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "LeadScoringSimulationStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "LeadScoringModel" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "LeadScoringModelStatus" NOT NULL DEFAULT 'DRAFT',
    "activeVersionId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadScoringModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadScoringModelVersion" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "LeadScoringModelStatus" NOT NULL DEFAULT 'DRAFT',
    "rulesHash" TEXT,
    "thresholdsHash" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadScoringModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadScoringRuleGroup" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scoreType" "LeadScoreType" NOT NULL,
    "maxGroupContribution" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LeadScoringRuleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadScoringRule" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "signalCategory" "LeadScoringSignalCategory" NOT NULL,
    "operator" "LeadScoringRuleOperator" NOT NULL,
    "value" JSONB,
    "scoreEffect" DOUBLE PRECISION NOT NULL,
    "maxContribution" DOUBLE PRECISION,
    "decayType" "LeadScoringDecayType" NOT NULL DEFAULT 'NONE',
    "decayHalfLifeDays" INTEGER,
    "windowDays" INTEGER,
    "evidence" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "allowDecay" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LeadScoringRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadScoreSnapshot" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "fitScore" DOUBLE PRECISION,
    "engagementScore" DOUBLE PRECISION,
    "intentScore" DOUBLE PRECISION,
    "relationshipScore" DOUBLE PRECISION,
    "productReadinessScore" DOUBLE PRECISION,
    "riskScore" DOUBLE PRECISION,
    "combinedScore" DOUBLE PRECISION,
    "qualificationStatus" "LeadScoringQualificationStatus" NOT NULL DEFAULT 'UNREVIEWED',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadScoreContribution" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "scoreType" "LeadScoreType" NOT NULL,
    "rawContribution" DOUBLE PRECISION NOT NULL,
    "cappedContribution" DOUBLE PRECISION NOT NULL,
    "evidence" JSONB,
    "decayApplied" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LeadScoreContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadQualificationModel" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "LeadScoringModelStatus" NOT NULL DEFAULT 'DRAFT',
    "scoringModelId" TEXT,
    "activeVersionId" TEXT,
    "thresholds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadQualificationModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadQualificationModelVersion" (
    "id" TEXT NOT NULL,
    "qualificationModelId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "LeadScoringModelStatus" NOT NULL DEFAULT 'DRAFT',
    "thresholdsHash" TEXT,
    "stateMappings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadQualificationModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadQualificationResult" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "qualificationModelId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "scoringSnapshotId" TEXT,
    "status" "LeadScoringQualificationStatus" NOT NULL DEFAULT 'UNREVIEWED',
    "score" DOUBLE PRECISION,
    "threshold" DOUBLE PRECISION,
    "evidence" JSONB,
    "missingInfo" JSONB,
    "hasOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadQualificationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadQualificationOverride" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "previousStatus" "LeadScoringQualificationStatus" NOT NULL,
    "newStatus" "LeadScoringQualificationStatus" NOT NULL,
    "reason" TEXT,
    "overriddenByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadQualificationOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadScoringSimulation" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" "LeadScoringSimulationStatus" NOT NULL DEFAULT 'DRAFT',
    "parameters" JSONB,
    "results" JSONB,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadScoringSimulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadScoringOutcome" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "outcomeType" TEXT NOT NULL,
    "outcomeValue" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "LeadScoringOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadScoringModel_organisationId_brandId_status_idx" ON "LeadScoringModel"("organisationId", "brandId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LeadScoringModelVersion_modelId_versionNumber_key" ON "LeadScoringModelVersion"("modelId", "versionNumber");

-- CreateIndex
CREATE INDEX "LeadScoringRuleGroup_versionId_idx" ON "LeadScoringRuleGroup"("versionId");

-- CreateIndex
CREATE INDEX "LeadScoringRule_groupId_idx" ON "LeadScoringRule"("groupId");

-- CreateIndex
CREATE INDEX "LeadScoreSnapshot_leadId_calculatedAt_idx" ON "LeadScoreSnapshot"("leadId", "calculatedAt");

-- CreateIndex
CREATE INDEX "LeadScoreSnapshot_modelId_versionId_idx" ON "LeadScoreSnapshot"("modelId", "versionId");

-- CreateIndex
CREATE INDEX "LeadScoreContribution_snapshotId_idx" ON "LeadScoreContribution"("snapshotId");

-- CreateIndex
CREATE INDEX "LeadScoreContribution_ruleId_idx" ON "LeadScoreContribution"("ruleId");

-- CreateIndex
CREATE INDEX "LeadQualificationModel_organisationId_brandId_status_idx" ON "LeadQualificationModel"("organisationId", "brandId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LeadQualificationModelVersion_qualificationModelId_versionNumber_key" ON "LeadQualificationModelVersion"("qualificationModelId", "versionNumber");

-- CreateIndex
CREATE INDEX "LeadQualificationResult_leadId_qualificationModelId_idx" ON "LeadQualificationResult"("leadId", "qualificationModelId");

-- CreateIndex
CREATE INDEX "LeadQualificationResult_scoringSnapshotId_idx" ON "LeadQualificationResult"("scoringSnapshotId");

-- CreateIndex
CREATE INDEX "LeadQualificationOverride_resultId_idx" ON "LeadQualificationOverride"("resultId");

-- CreateIndex
CREATE INDEX "LeadScoringSimulation_modelId_versionId_idx" ON "LeadScoringSimulation"("modelId", "versionId");

-- CreateIndex
CREATE INDEX "LeadScoringOutcome_snapshotId_recordedAt_idx" ON "LeadScoringOutcome"("snapshotId", "recordedAt");

-- AddForeignKey
ALTER TABLE "LeadScoringModel" ADD CONSTRAINT "LeadScoringModel_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScoringModel" ADD CONSTRAINT "LeadScoringModel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScoringModel" ADD CONSTRAINT "LeadScoringModel_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScoringModel" ADD CONSTRAINT "LeadScoringModel_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScoringModel" ADD CONSTRAINT "LeadScoringModel_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScoringModel" ADD CONSTRAINT "LeadScoringModel_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "LeadScoringModelVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScoringModelVersion" ADD CONSTRAINT "LeadScoringModelVersion_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "LeadScoringModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScoringRuleGroup" ADD CONSTRAINT "LeadScoringRuleGroup_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "LeadScoringModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScoringRule" ADD CONSTRAINT "LeadScoringRule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LeadScoringRuleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScoreSnapshot" ADD CONSTRAINT "LeadScoreSnapshot_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScoreSnapshot" ADD CONSTRAINT "LeadScoreSnapshot_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "LeadScoringModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScoreSnapshot" ADD CONSTRAINT "LeadScoreSnapshot_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "LeadScoringModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScoreContribution" ADD CONSTRAINT "LeadScoreContribution_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "LeadScoreSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScoreContribution" ADD CONSTRAINT "LeadScoreContribution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "LeadScoringRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadQualificationModel" ADD CONSTRAINT "LeadQualificationModel_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadQualificationModel" ADD CONSTRAINT "LeadQualificationModel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadQualificationModel" ADD CONSTRAINT "LeadQualificationModel_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadQualificationModel" ADD CONSTRAINT "LeadQualificationModel_scoringModelId_fkey" FOREIGN KEY ("scoringModelId") REFERENCES "LeadScoringModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadQualificationModel" ADD CONSTRAINT "LeadQualificationModel_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "LeadQualificationModelVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadQualificationModelVersion" ADD CONSTRAINT "LeadQualificationModelVersion_qualificationModelId_fkey" FOREIGN KEY ("qualificationModelId") REFERENCES "LeadQualificationModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadQualificationResult" ADD CONSTRAINT "LeadQualificationResult_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadQualificationResult" ADD CONSTRAINT "LeadQualificationResult_qualificationModelId_fkey" FOREIGN KEY ("qualificationModelId") REFERENCES "LeadQualificationModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadQualificationResult" ADD CONSTRAINT "LeadQualificationResult_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "LeadQualificationModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadQualificationResult" ADD CONSTRAINT "LeadQualificationResult_scoringSnapshotId_fkey" FOREIGN KEY ("scoringSnapshotId") REFERENCES "LeadScoreSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadQualificationOverride" ADD CONSTRAINT "LeadQualificationOverride_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "LeadQualificationResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadQualificationOverride" ADD CONSTRAINT "LeadQualificationOverride_overriddenByUserId_fkey" FOREIGN KEY ("overriddenByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScoringSimulation" ADD CONSTRAINT "LeadScoringSimulation_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "LeadScoringModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScoringSimulation" ADD CONSTRAINT "LeadScoringSimulation_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "LeadScoringModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScoringSimulation" ADD CONSTRAINT "LeadScoringSimulation_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScoringOutcome" ADD CONSTRAINT "LeadScoringOutcome_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "LeadScoreSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
