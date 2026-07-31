-- Task 6.4: CRM Tasks, Activities and Follow-Up Management

-- CreateEnum
CREATE TYPE "CrmTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DEFERRED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "CrmTaskTypeCode" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'REVIEW', 'RESEARCH', 'FOLLOW_UP', 'PROPOSAL', 'DEMO', 'ONBOARDING', 'RENEWAL', 'DATA_FIX', 'OTHER');

-- CreateEnum
CREATE TYPE "CrmActivityType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FORM_SUBMISSION', 'STATUS_CHANGE', 'OTHER');

-- CreateEnum
CREATE TYPE "CrmActivityVisibility" AS ENUM ('STANDARD', 'RESTRICTED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "CrmFollowUpRuleTrigger" AS ENUM ('NEW_LEAD_NO_OWNER', 'QUALIFIED_LEAD_NO_TASK', 'DEMO_REQUEST_NOT_CONTACTED', 'MEETING_NO_NEXT_STEP', 'PROPOSAL_NO_FOLLOW_UP', 'TRIAL_ENDING', 'OPPORTUNITY_INACTIVE', 'RENEWAL_APPROACHING', 'PAYMENT_FAILED', 'LEAD_REPLIED_NO_TASK');

-- CreateEnum
CREATE TYPE "CrmFollowUpSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CrmCalendarProvider" AS ENUM ('GOOGLE', 'MICROSOFT', 'SCHEDULING_PROVIDER');

-- CreateTable
CREATE TABLE "CrmTaskType" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT,
    "code" "CrmTaskTypeCode" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmTaskType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmTask" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "taskTypeId" TEXT,
    "taskTypeCode" "CrmTaskTypeCode" NOT NULL DEFAULT 'OTHER',
    "status" "CrmTaskStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "dueTime" TEXT,
    "timezone" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "leadId" TEXT,
    "contactId" TEXT,
    "companyId" TEXT,
    "opportunityId" TEXT,
    "formSubmissionId" TEXT,
    "campaignId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "deferredUntil" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "CrmTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmTaskAssignment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "reason" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmTaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmTaskReminder" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "reminderType" TEXT NOT NULL DEFAULT 'BEFORE_DUE',
    "minutesBefore" INTEGER,
    "timezone" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmTaskReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmTaskDependency" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "dependsOnTaskId" TEXT NOT NULL,

    CONSTRAINT "CrmTaskDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmTaskCompletion" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "completedById" TEXT NOT NULL,
    "outcome" TEXT,
    "notes" TEXT,
    "nextAction" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmTaskCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmActivity" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "activityType" "CrmActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "outcome" TEXT,
    "nextAction" TEXT,
    "durationMinutes" INTEGER,
    "visibility" "CrmActivityVisibility" NOT NULL DEFAULT 'STANDARD',
    "loggedByUserId" TEXT NOT NULL,
    "leadId" TEXT,
    "companyId" TEXT,
    "opportunityId" TEXT,
    "taskId" TEXT,
    "formSubmissionId" TEXT,
    "campaignId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmActivityParticipant" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "personId" TEXT,
    "userId" TEXT,
    "name" TEXT,
    "role" TEXT,

    CONSTRAINT "CrmActivityParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmNote" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmCallLog" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'OUTBOUND',
    "phoneNumber" TEXT,
    "durationMinutes" INTEGER,
    "disposition" TEXT,
    "loggedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmMeetingRecord" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "location" TEXT,
    "calendarProvider" "CrmCalendarProvider",
    "externalEventId" TEXT,
    "outcome" TEXT,
    "followUpTaskId" TEXT,
    "loggedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmMeetingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmFollowUpRule" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "trigger" "CrmFollowUpRuleTrigger" NOT NULL,
    "conditions" JSONB,
    "taskTypeCode" "CrmTaskTypeCode" NOT NULL DEFAULT 'FOLLOW_UP',
    "dueOffsetHours" INTEGER NOT NULL DEFAULT 24,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmFollowUpRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmFollowUpSuggestion" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "ruleId" TEXT,
    "taskId" TEXT,
    "leadId" TEXT,
    "opportunityId" TEXT,
    "status" "CrmFollowUpSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "suggestionType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "recommendedTaskType" "CrmTaskTypeCode",
    "recommendedDueAt" TIMESTAMP(3),
    "aiEvidence" JSONB,
    "aiGrounded" BOOLEAN NOT NULL DEFAULT true,
    "autoSendBlocked" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "CrmFollowUpSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmTaskType_organisationId_code_key" ON "CrmTaskType"("organisationId", "code");

-- CreateIndex
CREATE INDEX "CrmTaskType_brandId_idx" ON "CrmTaskType"("brandId");

-- CreateIndex
CREATE INDEX "CrmTask_organisationId_brandId_status_idx" ON "CrmTask"("organisationId", "brandId", "status");

-- CreateIndex
CREATE INDEX "CrmTask_ownerUserId_status_idx" ON "CrmTask"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "CrmTask_dueDate_idx" ON "CrmTask"("dueDate");

-- CreateIndex
CREATE INDEX "CrmTask_opportunityId_idx" ON "CrmTask"("opportunityId");

-- CreateIndex
CREATE INDEX "CrmTask_leadId_idx" ON "CrmTask"("leadId");

-- CreateIndex
CREATE INDEX "CrmTaskAssignment_taskId_idx" ON "CrmTaskAssignment"("taskId");

-- CreateIndex
CREATE INDEX "CrmTaskReminder_taskId_remindAt_idx" ON "CrmTaskReminder"("taskId", "remindAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrmTaskDependency_taskId_dependsOnTaskId_key" ON "CrmTaskDependency"("taskId", "dependsOnTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmTaskCompletion_taskId_key" ON "CrmTaskCompletion"("taskId");

-- CreateIndex
CREATE INDEX "CrmActivity_organisationId_brandId_occurredAt_idx" ON "CrmActivity"("organisationId", "brandId", "occurredAt");

-- CreateIndex
CREATE INDEX "CrmActivity_leadId_idx" ON "CrmActivity"("leadId");

-- CreateIndex
CREATE INDEX "CrmActivity_opportunityId_idx" ON "CrmActivity"("opportunityId");

-- CreateIndex
CREATE INDEX "CrmActivityParticipant_activityId_idx" ON "CrmActivityParticipant"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmNote_activityId_key" ON "CrmNote"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmCallLog_activityId_key" ON "CrmCallLog"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmMeetingRecord_activityId_key" ON "CrmMeetingRecord"("activityId");

-- CreateIndex
CREATE INDEX "CrmMeetingRecord_externalEventId_idx" ON "CrmMeetingRecord"("externalEventId");

-- CreateIndex
CREATE INDEX "CrmFollowUpRule_organisationId_brandId_trigger_idx" ON "CrmFollowUpRule"("organisationId", "brandId", "trigger");

-- CreateIndex
CREATE INDEX "CrmFollowUpSuggestion_organisationId_brandId_status_idx" ON "CrmFollowUpSuggestion"("organisationId", "brandId", "status");

-- AddForeignKey
ALTER TABLE "CrmTaskType" ADD CONSTRAINT "CrmTaskType_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTaskType" ADD CONSTRAINT "CrmTaskType_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_taskTypeId_fkey" FOREIGN KEY ("taskTypeId") REFERENCES "CrmTaskType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CrmCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_formSubmissionId_fkey" FOREIGN KEY ("formSubmissionId") REFERENCES "LeadCaptureSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTaskAssignment" ADD CONSTRAINT "CrmTaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CrmTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTaskAssignment" ADD CONSTRAINT "CrmTaskAssignment_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTaskAssignment" ADD CONSTRAINT "CrmTaskAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTaskReminder" ADD CONSTRAINT "CrmTaskReminder_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CrmTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTaskDependency" ADD CONSTRAINT "CrmTaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CrmTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTaskDependency" ADD CONSTRAINT "CrmTaskDependency_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "CrmTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTaskCompletion" ADD CONSTRAINT "CrmTaskCompletion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CrmTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTaskCompletion" ADD CONSTRAINT "CrmTaskCompletion_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_loggedByUserId_fkey" FOREIGN KEY ("loggedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CrmCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CrmTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivityParticipant" ADD CONSTRAINT "CrmActivityParticipant_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CrmActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivityParticipant" ADD CONSTRAINT "CrmActivityParticipant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "CrmPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivityParticipant" ADD CONSTRAINT "CrmActivityParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmNote" ADD CONSTRAINT "CrmNote_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CrmActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmNote" ADD CONSTRAINT "CrmNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmCallLog" ADD CONSTRAINT "CrmCallLog_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CrmActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmCallLog" ADD CONSTRAINT "CrmCallLog_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmMeetingRecord" ADD CONSTRAINT "CrmMeetingRecord_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CrmActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmMeetingRecord" ADD CONSTRAINT "CrmMeetingRecord_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmFollowUpRule" ADD CONSTRAINT "CrmFollowUpRule_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmFollowUpRule" ADD CONSTRAINT "CrmFollowUpRule_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmFollowUpSuggestion" ADD CONSTRAINT "CrmFollowUpSuggestion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmFollowUpSuggestion" ADD CONSTRAINT "CrmFollowUpSuggestion_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmFollowUpSuggestion" ADD CONSTRAINT "CrmFollowUpSuggestion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CrmTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
