-- Task 6.3: Sales Pipeline and Opportunity Management

-- CreateEnum
CREATE TYPE "CrmPipelineType" AS ENUM ('GRANTS_SUBSCRIPTION', 'CAPITAL_TERMINAL', 'ENTERPRISE_SALES', 'PARTNERSHIPS', 'MANAGED_MARKETING', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CrmPipelineStageCategory" AS ENUM ('OPEN', 'QUALIFICATION', 'DISCOVERY', 'EVALUATION', 'PROPOSAL', 'NEGOTIATION', 'TRIAL', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "CrmOpportunityStatus" AS ENUM ('OPEN', 'WON', 'LOST', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CrmOpportunityContactRoleType" AS ENUM ('DECISION_MAKER', 'CHAMPION', 'INFLUENCER', 'ECONOMIC_BUYER', 'TECHNICAL_EVALUATOR', 'OTHER');

-- CreateEnum
CREATE TYPE "CrmOpportunityApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CrmWonEvidenceType" AS ENUM ('SUBSCRIPTION_CONFIRMED', 'PAYMENT_COMPLETED', 'AGREEMENT_SIGNED', 'AUTHORISED_CONFIRMATION');

-- CreateTable
CREATE TABLE "CrmPipeline" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "pipelineType" "CrmPipelineType" NOT NULL DEFAULT 'CUSTOM',
    "description" TEXT,
    "currentVersionId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "CrmPipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmPipelineVersion" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmPipelineVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmPipelineStage" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "category" "CrmPipelineStageCategory" NOT NULL,
    "probability" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "entryCriteria" JSONB,
    "exitCriteria" JSONB,
    "requiredFields" JSONB,
    "maxDurationDays" INTEGER,
    "automationEligible" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmPipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmOpportunity" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "pipelineVersionId" TEXT NOT NULL,
    "currentStageId" TEXT NOT NULL,
    "leadId" TEXT,
    "companyId" TEXT,
    "ownerUserId" TEXT,
    "name" TEXT NOT NULL,
    "status" "CrmOpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "product" TEXT,
    "plan" TEXT,
    "expectedCloseDate" TIMESTAMP(3),
    "probability" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "campaign" TEXT,
    "attributionJourneyId" TEXT,
    "nextAction" TEXT,
    "notes" TEXT,
    "lossReasonId" TEXT,
    "lossNotes" TEXT,
    "reEngagementEligible" BOOLEAN NOT NULL DEFAULT false,
    "wonEvidenceType" "CrmWonEvidenceType",
    "wonEvidenceReference" TEXT,
    "stageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "CrmOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmOpportunityStageHistory" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "previousStageId" TEXT,
    "newStageId" TEXT NOT NULL,
    "previousCategory" "CrmPipelineStageCategory",
    "newCategory" "CrmPipelineStageCategory" NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmOpportunityStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmOpportunityProduct" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "plan" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmOpportunityProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmOpportunityContactRole" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "roleType" "CrmOpportunityContactRoleType" NOT NULL DEFAULT 'OTHER',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmOpportunityContactRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmOpportunityValue" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "valueType" TEXT NOT NULL DEFAULT 'EXPECTED',
    "amount" DECIMAL(24,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringPeriod" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmOpportunityValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmOpportunityProbability" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "probability" DECIMAL(5,2) NOT NULL,
    "reason" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmOpportunityProbability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmOpportunityLossReason" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT,
    "label" TEXT NOT NULL,
    "reEngagementDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmOpportunityLossReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmOpportunityCompetitor" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmOpportunityCompetitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmOpportunityApproval" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "stageId" TEXT,
    "status" "CrmOpportunityApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "CrmOpportunityApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmPipeline_brandId_slug_key" ON "CrmPipeline"("brandId", "slug");

-- CreateIndex
CREATE INDEX "CrmPipeline_organisationId_brandId_idx" ON "CrmPipeline"("organisationId", "brandId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmPipelineVersion_pipelineId_versionNumber_key" ON "CrmPipelineVersion"("pipelineId", "versionNumber");

-- CreateIndex
CREATE INDEX "CrmPipelineVersion_pipelineId_isActive_idx" ON "CrmPipelineVersion"("pipelineId", "isActive");

-- CreateIndex
CREATE INDEX "CrmPipelineStage_versionId_sortOrder_idx" ON "CrmPipelineStage"("versionId", "sortOrder");

-- CreateIndex
CREATE INDEX "CrmOpportunity_organisationId_brandId_status_idx" ON "CrmOpportunity"("organisationId", "brandId", "status");

-- CreateIndex
CREATE INDEX "CrmOpportunity_pipelineId_currentStageId_idx" ON "CrmOpportunity"("pipelineId", "currentStageId");

-- CreateIndex
CREATE INDEX "CrmOpportunity_ownerUserId_idx" ON "CrmOpportunity"("ownerUserId");

-- CreateIndex
CREATE INDEX "CrmOpportunity_expectedCloseDate_idx" ON "CrmOpportunity"("expectedCloseDate");

-- CreateIndex
CREATE INDEX "CrmOpportunity_leadId_idx" ON "CrmOpportunity"("leadId");

-- CreateIndex
CREATE INDEX "CrmOpportunityStageHistory_opportunityId_createdAt_idx" ON "CrmOpportunityStageHistory"("opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX "CrmOpportunityProduct_opportunityId_idx" ON "CrmOpportunityProduct"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmOpportunityContactRole_opportunityId_personId_roleType_key" ON "CrmOpportunityContactRole"("opportunityId", "personId", "roleType");

-- CreateIndex
CREATE INDEX "CrmOpportunityContactRole_opportunityId_idx" ON "CrmOpportunityContactRole"("opportunityId");

-- CreateIndex
CREATE INDEX "CrmOpportunityValue_opportunityId_valueType_idx" ON "CrmOpportunityValue"("opportunityId", "valueType");

-- CreateIndex
CREATE INDEX "CrmOpportunityProbability_opportunityId_createdAt_idx" ON "CrmOpportunityProbability"("opportunityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrmOpportunityLossReason_organisationId_label_key" ON "CrmOpportunityLossReason"("organisationId", "label");

-- CreateIndex
CREATE INDEX "CrmOpportunityLossReason_organisationId_brandId_idx" ON "CrmOpportunityLossReason"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "CrmOpportunityCompetitor_opportunityId_idx" ON "CrmOpportunityCompetitor"("opportunityId");

-- CreateIndex
CREATE INDEX "CrmOpportunityApproval_opportunityId_status_idx" ON "CrmOpportunityApproval"("opportunityId", "status");

-- AddForeignKey
ALTER TABLE "CrmPipeline" ADD CONSTRAINT "CrmPipeline_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmPipeline" ADD CONSTRAINT "CrmPipeline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmPipeline" ADD CONSTRAINT "CrmPipeline_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmPipeline" ADD CONSTRAINT "CrmPipeline_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmPipelineVersion" ADD CONSTRAINT "CrmPipelineVersion_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "CrmPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmPipelineStage" ADD CONSTRAINT "CrmPipelineStage_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "CrmPipelineVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "CrmPipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_pipelineVersionId_fkey" FOREIGN KEY ("pipelineVersionId") REFERENCES "CrmPipelineVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "CrmPipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CrmCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunity" ADD CONSTRAINT "CrmOpportunity_lossReasonId_fkey" FOREIGN KEY ("lossReasonId") REFERENCES "CrmOpportunityLossReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunityStageHistory" ADD CONSTRAINT "CrmOpportunityStageHistory_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunityStageHistory" ADD CONSTRAINT "CrmOpportunityStageHistory_newStageId_fkey" FOREIGN KEY ("newStageId") REFERENCES "CrmPipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunityStageHistory" ADD CONSTRAINT "CrmOpportunityStageHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunityProduct" ADD CONSTRAINT "CrmOpportunityProduct_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunityContactRole" ADD CONSTRAINT "CrmOpportunityContactRole_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunityContactRole" ADD CONSTRAINT "CrmOpportunityContactRole_personId_fkey" FOREIGN KEY ("personId") REFERENCES "CrmPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunityValue" ADD CONSTRAINT "CrmOpportunityValue_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunityProbability" ADD CONSTRAINT "CrmOpportunityProbability_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunityLossReason" ADD CONSTRAINT "CrmOpportunityLossReason_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunityLossReason" ADD CONSTRAINT "CrmOpportunityLossReason_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunityCompetitor" ADD CONSTRAINT "CrmOpportunityCompetitor_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunityApproval" ADD CONSTRAINT "CrmOpportunityApproval_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOpportunityApproval" ADD CONSTRAINT "CrmOpportunityApproval_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
