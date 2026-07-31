-- Task 6.9: Lifecycle Agent

-- CreateEnum
CREATE TYPE "LifecycleAgentRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LifecycleAgentReviewType" AS ENUM ('DAILY_SALES_BRIEF', 'WEEKLY_PIPELINE_REVIEW', 'TRIAL_RISK_REVIEW', 'RENEWAL_REVIEW', 'LIFECYCLE_HEALTH_SUMMARY', 'ON_DEMAND');

-- CreateEnum
CREATE TYPE "LifecycleAgentFindingType" AS ENUM ('NEW_HIGH_PRIORITY_LEAD', 'LEAD_WITHOUT_OWNER', 'LEAD_WITHOUT_FOLLOW_UP', 'STALE_LEAD', 'QUALIFICATION_DATA_MISSING', 'OPPORTUNITY_STALLED', 'NO_NEXT_ACTION', 'TRIAL_NOT_ACTIVATED', 'TRIAL_ENDING', 'PAYMENT_FAILED', 'CUSTOMER_INACTIVE', 'RENEWAL_APPROACHING', 'CROSS_SELL_OPPORTUNITY', 'CHURN_RISK_SIGNAL', 'DATA_QUALITY_ISSUE', 'CONSENT_RESTRICTION', 'OTHER');

-- CreateEnum
CREATE TYPE "LifecycleAgentRecommendationType" AS ENUM ('ASSIGN_OWNER', 'CREATE_TASK', 'REQUEST_QUALIFICATION_INFO', 'PREPARE_CALL', 'DRAFT_FOLLOW_UP', 'BOOK_DEMO', 'REVIEW_OPPORTUNITY', 'EXTEND_NURTURE', 'END_AUTOMATION', 'INVESTIGATE_PAYMENT', 'PREPARE_RENEWAL_OUTREACH', 'CREATE_CS_TASK', 'REVIEW_CROSS_SELL', 'MARK_MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "LifecycleAgentDraftType" AS ENUM ('EMAIL', 'LINKEDIN_RESPONSE', 'MEETING_CONFIRMATION', 'POST_DEMO_FOLLOW_UP', 'TRIAL_REMINDER', 'PAYMENT_REMINDER', 'RENEWAL_NOTE', 'REENGAGEMENT_MESSAGE');

-- CreateEnum
CREATE TYPE "LifecycleAgentActionType" AS ENUM ('CREATE_TASK', 'ASSIGN_OWNER_REQUEST', 'CREATE_MESSAGE_DRAFT', 'CREATE_MEETING_PREPARATION', 'CREATE_NURTURE_ENROLLMENT_REQUEST', 'CREATE_PIPELINE_REVIEW', 'CREATE_RENEWAL_TASK', 'CREATE_DATA_FIX', 'DISMISS_FINDING');

-- CreateEnum
CREATE TYPE "LifecycleAgentApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LifecycleAgentFeedbackStatus" AS ENUM ('ACCEPTED', 'REJECTED', 'EDITED', 'DEFERRED', 'ACTION_COMPLETED', 'OUTCOME_MEASURED', 'OUTCOME_UNKNOWN');

-- CreateTable
CREATE TABLE "LifecycleAgentRun" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "reviewType" "LifecycleAgentReviewType" NOT NULL,
    "status" "LifecycleAgentRunStatus" NOT NULL DEFAULT 'PENDING',
    "dateRangeStart" TIMESTAMP(3) NOT NULL,
    "dateRangeEnd" TIMESTAMP(3) NOT NULL,
    "initiatedByUserId" TEXT NOT NULL,
    "summary" TEXT,
    "limitations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifecycleAgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifecycleAgentFinding" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "findingType" "LifecycleAgentFindingType" NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "crmRecordType" TEXT,
    "crmRecordId" TEXT,
    "crmLeadId" TEXT,
    "crmOpportunityId" TEXT,
    "priorityScore" DOUBLE PRECISION,
    "dataConfidence" DOUBLE PRECISION,
    "limitations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LifecycleAgentFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifecycleAgentRecommendation" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "findingId" TEXT,
    "recommendationType" "LifecycleAgentRecommendationType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priorityScore" DOUBLE PRECISION,
    "rationale" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LifecycleAgentRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifecycleAgentEvidence" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "findingId" TEXT,
    "crmRecordType" TEXT,
    "crmRecordId" TEXT,
    "crmLeadId" TEXT,
    "crmOpportunityId" TEXT,
    "dateRangeStart" TIMESTAMP(3) NOT NULL,
    "dateRangeEnd" TIMESTAMP(3) NOT NULL,
    "lifecycle" TEXT,
    "ownerUserId" TEXT,
    "activities" JSONB,
    "productEvents" JSONB,
    "scoreSnapshot" JSONB,
    "opportunityStage" TEXT,
    "subscriptionState" TEXT,
    "consent" JSONB,
    "sourceFreshness" JSONB,
    "missingInfo" JSONB,
    "alternativeExplanations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LifecycleAgentEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifecycleAgentDraft" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "draftType" "LifecycleAgentDraftType" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "toneProfile" TEXT,
    "consentEligible" BOOLEAN NOT NULL DEFAULT false,
    "safetyWarnings" JSONB,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifecycleAgentDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifecycleAgentActionProposal" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "actionType" "LifecycleAgentActionType" NOT NULL,
    "payload" JSONB,
    "status" "LifecycleAgentApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifecycleAgentActionProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifecycleAgentApproval" (
    "id" TEXT NOT NULL,
    "actionProposalId" TEXT NOT NULL,
    "status" "LifecycleAgentApprovalStatus" NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LifecycleAgentApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifecycleAgentFeedback" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "status" "LifecycleAgentFeedbackStatus" NOT NULL,
    "reason" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifecycleAgentFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifecycleAgentOutcome" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "actionProposalId" TEXT,
    "outcomeType" TEXT NOT NULL,
    "outcomeValue" TEXT,
    "measuredAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LifecycleAgentOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LifecycleAgentRun_organisationId_brandId_reviewType_idx" ON "LifecycleAgentRun"("organisationId", "brandId", "reviewType");

-- CreateIndex
CREATE INDEX "LifecycleAgentRun_status_createdAt_idx" ON "LifecycleAgentRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LifecycleAgentFinding_runId_findingType_idx" ON "LifecycleAgentFinding"("runId", "findingType");

-- CreateIndex
CREATE INDEX "LifecycleAgentFinding_crmRecordType_crmRecordId_idx" ON "LifecycleAgentFinding"("crmRecordType", "crmRecordId");

-- CreateIndex
CREATE INDEX "LifecycleAgentFinding_crmLeadId_idx" ON "LifecycleAgentFinding"("crmLeadId");

-- CreateIndex
CREATE INDEX "LifecycleAgentFinding_crmOpportunityId_idx" ON "LifecycleAgentFinding"("crmOpportunityId");

-- CreateIndex
CREATE INDEX "LifecycleAgentRecommendation_runId_recommendationType_idx" ON "LifecycleAgentRecommendation"("runId", "recommendationType");

-- CreateIndex
CREATE INDEX "LifecycleAgentEvidence_runId_idx" ON "LifecycleAgentEvidence"("runId");

-- CreateIndex
CREATE INDEX "LifecycleAgentEvidence_findingId_idx" ON "LifecycleAgentEvidence"("findingId");

-- CreateIndex
CREATE INDEX "LifecycleAgentEvidence_crmRecordType_crmRecordId_idx" ON "LifecycleAgentEvidence"("crmRecordType", "crmRecordId");

-- CreateIndex
CREATE INDEX "LifecycleAgentEvidence_crmLeadId_idx" ON "LifecycleAgentEvidence"("crmLeadId");

-- CreateIndex
CREATE INDEX "LifecycleAgentEvidence_crmOpportunityId_idx" ON "LifecycleAgentEvidence"("crmOpportunityId");

-- CreateIndex
CREATE INDEX "LifecycleAgentDraft_recommendationId_draftType_idx" ON "LifecycleAgentDraft"("recommendationId", "draftType");

-- CreateIndex
CREATE INDEX "LifecycleAgentActionProposal_recommendationId_actionType_idx" ON "LifecycleAgentActionProposal"("recommendationId", "actionType");

-- CreateIndex
CREATE INDEX "LifecycleAgentActionProposal_status_idx" ON "LifecycleAgentActionProposal"("status");

-- CreateIndex
CREATE INDEX "LifecycleAgentApproval_actionProposalId_idx" ON "LifecycleAgentApproval"("actionProposalId");

-- CreateIndex
CREATE INDEX "LifecycleAgentFeedback_recommendationId_status_idx" ON "LifecycleAgentFeedback"("recommendationId", "status");

-- CreateIndex
CREATE INDEX "LifecycleAgentOutcome_recommendationId_idx" ON "LifecycleAgentOutcome"("recommendationId");

-- CreateIndex
CREATE INDEX "LifecycleAgentOutcome_actionProposalId_idx" ON "LifecycleAgentOutcome"("actionProposalId");

-- AddForeignKey
ALTER TABLE "LifecycleAgentRun" ADD CONSTRAINT "LifecycleAgentRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentRun" ADD CONSTRAINT "LifecycleAgentRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentRun" ADD CONSTRAINT "LifecycleAgentRun_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentRun" ADD CONSTRAINT "LifecycleAgentRun_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentFinding" ADD CONSTRAINT "LifecycleAgentFinding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "LifecycleAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentFinding" ADD CONSTRAINT "LifecycleAgentFinding_crmLeadId_fkey" FOREIGN KEY ("crmLeadId") REFERENCES "CrmLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentFinding" ADD CONSTRAINT "LifecycleAgentFinding_crmOpportunityId_fkey" FOREIGN KEY ("crmOpportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentRecommendation" ADD CONSTRAINT "LifecycleAgentRecommendation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "LifecycleAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentRecommendation" ADD CONSTRAINT "LifecycleAgentRecommendation_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "LifecycleAgentFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentEvidence" ADD CONSTRAINT "LifecycleAgentEvidence_runId_fkey" FOREIGN KEY ("runId") REFERENCES "LifecycleAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentEvidence" ADD CONSTRAINT "LifecycleAgentEvidence_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "LifecycleAgentFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentEvidence" ADD CONSTRAINT "LifecycleAgentEvidence_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentEvidence" ADD CONSTRAINT "LifecycleAgentEvidence_crmLeadId_fkey" FOREIGN KEY ("crmLeadId") REFERENCES "CrmLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentEvidence" ADD CONSTRAINT "LifecycleAgentEvidence_crmOpportunityId_fkey" FOREIGN KEY ("crmOpportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentDraft" ADD CONSTRAINT "LifecycleAgentDraft_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "LifecycleAgentRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentActionProposal" ADD CONSTRAINT "LifecycleAgentActionProposal_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "LifecycleAgentRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentApproval" ADD CONSTRAINT "LifecycleAgentApproval_actionProposalId_fkey" FOREIGN KEY ("actionProposalId") REFERENCES "LifecycleAgentActionProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentApproval" ADD CONSTRAINT "LifecycleAgentApproval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentFeedback" ADD CONSTRAINT "LifecycleAgentFeedback_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "LifecycleAgentRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentFeedback" ADD CONSTRAINT "LifecycleAgentFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentOutcome" ADD CONSTRAINT "LifecycleAgentOutcome_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "LifecycleAgentRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleAgentOutcome" ADD CONSTRAINT "LifecycleAgentOutcome_actionProposalId_fkey" FOREIGN KEY ("actionProposalId") REFERENCES "LifecycleAgentActionProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
