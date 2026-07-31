-- Task 6.7: Marketing Automation

-- CreateEnum
CREATE TYPE "MarketingAutomationStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ACTIVE', 'PAUSED', 'STOPPED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MarketingAutomationTriggerType" AS ENUM ('FORM_SUBMITTED', 'LEAD_CREATED', 'LEAD_STATUS_CHANGED', 'LIFECYCLE_CHANGED', 'PIPELINE_STAGE_CHANGED', 'EMAIL_EVENT', 'WEBSITE_EVENT', 'CONTENT_DOWNLOADED', 'DEMO_REQUESTED', 'TRIAL_STARTED', 'TRIAL_ENDING', 'SUBSCRIPTION_STARTED', 'PAYMENT_FAILED', 'SUBSCRIPTION_CANCELLED', 'CUSTOMER_INACTIVE', 'DATE_REACHED', 'MANUAL_ENROLLMENT', 'SCHEDULED_SEGMENT_CHECK');

-- CreateEnum
CREATE TYPE "MarketingAutomationNodeType" AS ENUM ('TRIGGER', 'CONDITION', 'DELAY', 'ACTION', 'BRANCH', 'GOAL', 'EXIT', 'END');

-- CreateEnum
CREATE TYPE "MarketingAutomationActionType" AS ENUM ('SEND_EMAIL', 'CREATE_TASK', 'ASSIGN_OWNER', 'UPDATE_LEAD_STATUS', 'UPDATE_LIFECYCLE', 'APPLY_TAG', 'REMOVE_TAG', 'CREATE_OPPORTUNITY_PROPOSAL', 'ADD_TO_AUDIENCE', 'REMOVE_FROM_AUDIENCE', 'SEND_INTERNAL_NOTIFICATION', 'WAIT', 'BRANCH', 'END', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "MarketingAutomationEnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXITED', 'FAILED', 'PAUSED', 'REMOVED');

-- CreateEnum
CREATE TYPE "MarketingAutomationApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "MarketingAutomationDelayType" AS ENUM ('FIXED_DURATION', 'UNTIL_DATETIME', 'UNTIL_BUSINESS_DAY', 'UNTIL_DAYPART', 'WAIT_FOR_EVENT', 'WAIT_FOR_CONDITION');

-- CreateEnum
CREATE TYPE "MarketingAutomationConditionField" AS ENUM ('LIFECYCLE', 'LEAD_STATUS', 'OPPORTUNITY_STAGE', 'PRODUCT', 'COUNTRY', 'LANGUAGE', 'CONSENT', 'SOURCE', 'CAMPAIGN', 'ACTIVITY', 'EMAIL_ENGAGEMENT', 'PRODUCT_EVENT', 'SUBSCRIPTION_STATE', 'DATE', 'OWNER', 'TAG');

-- CreateEnum
CREATE TYPE "MarketingAutomationExitReason" AS ENUM ('CUSTOMER_CONVERTED', 'CONSENT_WITHDRAWN', 'LEAD_SUPPRESSED', 'OPPORTUNITY_LOST', 'SUBSCRIPTION_STARTED', 'SUPPORT_ISSUE_OPENED', 'MANUAL_REMOVAL', 'GOAL_ACHIEVED', 'MAX_DURATION_REACHED', 'AUTOMATION_STOPPED', 'ERROR');

-- CreateEnum
CREATE TYPE "MarketingAutomationRepeatPolicy" AS ENUM ('ONE_TIME', 'ALLOW_REPEAT', 'ALLOW_AFTER_COMPLETION');

-- CreateEnum
CREATE TYPE "MarketingAutomationEnrollmentSource" AS ENUM ('TRIGGER', 'MANUAL', 'API', 'TEST');

-- CreateTable
CREATE TABLE "MarketingAutomation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "MarketingAutomationStatus" NOT NULL DEFAULT 'DRAFT',
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "templateKey" TEXT,
    "repeatEnrollmentPolicy" "MarketingAutomationRepeatPolicy" NOT NULL DEFAULT 'ONE_TIME',
    "globalStopped" BOOLEAN NOT NULL DEFAULT false,
    "testMode" BOOLEAN NOT NULL DEFAULT false,
    "activeVersionId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "MarketingAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAutomationVersion" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "MarketingAutomationStatus" NOT NULL DEFAULT 'DRAFT',
    "triggerHash" TEXT,
    "conditionGraphHash" TEXT,
    "actionGraphHash" TEXT,
    "templateHash" TEXT,
    "delayHash" TEXT,
    "frequencyLimitHash" TEXT,
    "exitRuleHash" TEXT,
    "testMode" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingAutomationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAutomationTrigger" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "triggerType" "MarketingAutomationTriggerType" NOT NULL,
    "config" JSONB NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MarketingAutomationTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAutomationNode" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "nodeKey" TEXT NOT NULL,
    "nodeType" "MarketingAutomationNodeType" NOT NULL,
    "label" TEXT,
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "config" JSONB,

    CONSTRAINT "MarketingAutomationNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAutomationEdge" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "branchLabel" TEXT,

    CONSTRAINT "MarketingAutomationEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAutomationCondition" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "field" "MarketingAutomationConditionField" NOT NULL,
    "operator" TEXT NOT NULL,
    "value" JSONB,

    CONSTRAINT "MarketingAutomationCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAutomationDelay" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "delayType" "MarketingAutomationDelayType" NOT NULL,
    "durationMinutes" INTEGER,
    "untilAt" TIMESTAMP(3),
    "timezone" TEXT,
    "businessDaysOnly" BOOLEAN NOT NULL DEFAULT false,
    "daypartStart" TEXT,
    "daypartEnd" TEXT,
    "waitEventType" TEXT,
    "maxWaitMinutes" INTEGER,
    "config" JSONB,

    CONSTRAINT "MarketingAutomationDelay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAutomationGoal" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "goalType" TEXT NOT NULL,
    "config" JSONB,

    CONSTRAINT "MarketingAutomationGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAutomationExitRule" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "exitReason" "MarketingAutomationExitReason" NOT NULL,
    "config" JSONB,
    "evaluateBeforeMessaging" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MarketingAutomationExitRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAutomationEnrollment" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" "MarketingAutomationEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrollmentSource" "MarketingAutomationEnrollmentSource" NOT NULL,
    "dedupeKey" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "exitedAt" TIMESTAMP(3),
    "exitReason" "MarketingAutomationExitReason",
    "currentNodeId" TEXT,
    "isTestEnrollment" BOOLEAN NOT NULL DEFAULT false,
    "enrolledByUserId" TEXT,

    CONSTRAINT "MarketingAutomationEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAutomationEnrollmentState" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "MarketingAutomationEnrollmentState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAutomationActionRun" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "actionType" "MarketingAutomationActionType" NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "result" JSONB,
    "errorMessage" TEXT,

    CONSTRAINT "MarketingAutomationActionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAutomationError" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "nodeId" TEXT,
    "errorCode" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingAutomationError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAutomationApproval" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" "MarketingAutomationApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "triggerHash" TEXT,
    "conditionGraphHash" TEXT,
    "actionGraphHash" TEXT,
    "templateHash" TEXT,
    "delayHash" TEXT,
    "frequencyLimitHash" TEXT,
    "exitRuleHash" TEXT,
    "approverUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingAutomationApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingAutomation_organisationId_brandId_status_idx" ON "MarketingAutomation"("organisationId", "brandId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAutomationVersion_automationId_versionNumber_key" ON "MarketingAutomationVersion"("automationId", "versionNumber");

-- CreateIndex
CREATE INDEX "MarketingAutomationTrigger_versionId_idx" ON "MarketingAutomationTrigger"("versionId");

-- CreateIndex
CREATE INDEX "MarketingAutomationNode_versionId_idx" ON "MarketingAutomationNode"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAutomationNode_versionId_nodeKey_key" ON "MarketingAutomationNode"("versionId", "nodeKey");

-- CreateIndex
CREATE INDEX "MarketingAutomationEdge_versionId_idx" ON "MarketingAutomationEdge"("versionId");

-- CreateIndex
CREATE INDEX "MarketingAutomationEdge_sourceNodeId_idx" ON "MarketingAutomationEdge"("sourceNodeId");

-- CreateIndex
CREATE INDEX "MarketingAutomationEdge_targetNodeId_idx" ON "MarketingAutomationEdge"("targetNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAutomationCondition_nodeId_key" ON "MarketingAutomationCondition"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAutomationDelay_nodeId_key" ON "MarketingAutomationDelay"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAutomationGoal_nodeId_key" ON "MarketingAutomationGoal"("nodeId");

-- CreateIndex
CREATE INDEX "MarketingAutomationGoal_versionId_idx" ON "MarketingAutomationGoal"("versionId");

-- CreateIndex
CREATE INDEX "MarketingAutomationExitRule_versionId_idx" ON "MarketingAutomationExitRule"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAutomationEnrollment_automationId_dedupeKey_key" ON "MarketingAutomationEnrollment"("automationId", "dedupeKey");

-- CreateIndex
CREATE INDEX "MarketingAutomationEnrollment_automationId_status_idx" ON "MarketingAutomationEnrollment"("automationId", "status");

-- CreateIndex
CREATE INDEX "MarketingAutomationEnrollment_leadId_idx" ON "MarketingAutomationEnrollment"("leadId");

-- CreateIndex
CREATE INDEX "MarketingAutomationEnrollment_versionId_idx" ON "MarketingAutomationEnrollment"("versionId");

-- CreateIndex
CREATE INDEX "MarketingAutomationEnrollmentState_enrollmentId_idx" ON "MarketingAutomationEnrollmentState"("enrollmentId");

-- CreateIndex
CREATE INDEX "MarketingAutomationEnrollmentState_nodeId_idx" ON "MarketingAutomationEnrollmentState"("nodeId");

-- CreateIndex
CREATE INDEX "MarketingAutomationActionRun_enrollmentId_idx" ON "MarketingAutomationActionRun"("enrollmentId");

-- CreateIndex
CREATE INDEX "MarketingAutomationActionRun_nodeId_idx" ON "MarketingAutomationActionRun"("nodeId");

-- CreateIndex
CREATE INDEX "MarketingAutomationError_automationId_idx" ON "MarketingAutomationError"("automationId");

-- CreateIndex
CREATE INDEX "MarketingAutomationError_enrollmentId_idx" ON "MarketingAutomationError"("enrollmentId");

-- CreateIndex
CREATE INDEX "MarketingAutomationApproval_versionId_idx" ON "MarketingAutomationApproval"("versionId");

-- AddForeignKey
ALTER TABLE "MarketingAutomation" ADD CONSTRAINT "MarketingAutomation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomation" ADD CONSTRAINT "MarketingAutomation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomation" ADD CONSTRAINT "MarketingAutomation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomation" ADD CONSTRAINT "MarketingAutomation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomation" ADD CONSTRAINT "MarketingAutomation_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomation" ADD CONSTRAINT "MarketingAutomation_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "MarketingAutomationVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationVersion" ADD CONSTRAINT "MarketingAutomationVersion_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "MarketingAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationTrigger" ADD CONSTRAINT "MarketingAutomationTrigger_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "MarketingAutomationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationNode" ADD CONSTRAINT "MarketingAutomationNode_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "MarketingAutomationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationEdge" ADD CONSTRAINT "MarketingAutomationEdge_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "MarketingAutomationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationEdge" ADD CONSTRAINT "MarketingAutomationEdge_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "MarketingAutomationNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationEdge" ADD CONSTRAINT "MarketingAutomationEdge_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "MarketingAutomationNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationCondition" ADD CONSTRAINT "MarketingAutomationCondition_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "MarketingAutomationNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationDelay" ADD CONSTRAINT "MarketingAutomationDelay_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "MarketingAutomationNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationGoal" ADD CONSTRAINT "MarketingAutomationGoal_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "MarketingAutomationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationGoal" ADD CONSTRAINT "MarketingAutomationGoal_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "MarketingAutomationNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationExitRule" ADD CONSTRAINT "MarketingAutomationExitRule_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "MarketingAutomationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationEnrollment" ADD CONSTRAINT "MarketingAutomationEnrollment_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "MarketingAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationEnrollment" ADD CONSTRAINT "MarketingAutomationEnrollment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "MarketingAutomationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationEnrollment" ADD CONSTRAINT "MarketingAutomationEnrollment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationEnrollment" ADD CONSTRAINT "MarketingAutomationEnrollment_currentNodeId_fkey" FOREIGN KEY ("currentNodeId") REFERENCES "MarketingAutomationNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationEnrollment" ADD CONSTRAINT "MarketingAutomationEnrollment_enrolledByUserId_fkey" FOREIGN KEY ("enrolledByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationEnrollmentState" ADD CONSTRAINT "MarketingAutomationEnrollmentState_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "MarketingAutomationEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationEnrollmentState" ADD CONSTRAINT "MarketingAutomationEnrollmentState_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "MarketingAutomationNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationActionRun" ADD CONSTRAINT "MarketingAutomationActionRun_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "MarketingAutomationEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationActionRun" ADD CONSTRAINT "MarketingAutomationActionRun_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "MarketingAutomationNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationError" ADD CONSTRAINT "MarketingAutomationError_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "MarketingAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationError" ADD CONSTRAINT "MarketingAutomationError_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "MarketingAutomationEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationError" ADD CONSTRAINT "MarketingAutomationError_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "MarketingAutomationNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationApproval" ADD CONSTRAINT "MarketingAutomationApproval_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "MarketingAutomationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAutomationApproval" ADD CONSTRAINT "MarketingAutomationApproval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
