-- Stage 5: Canonical marketing tasks and approvals

-- CreateEnum
CREATE TYPE "MarketingTaskType" AS ENUM ('GENERAL', 'CONTENT', 'CAMPAIGN', 'ASSET', 'EXPERIMENT', 'APPROVAL', 'REVIEW', 'PUBLISHING', 'COMPLIANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "MarketingTaskStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MarketingTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "MarketingApprovalType" AS ENUM ('CONTENT', 'CAMPAIGN_ACTIVATION', 'BUDGET_CHANGE', 'ASSET_APPROVAL', 'AI_ACTION', 'OTHER');

-- CreateEnum
CREATE TYPE "MarketingApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MarketingTaskActivityType" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'ASSIGNED', 'COMMENT_ADDED', 'CHECKLIST_UPDATED', 'DEPENDENCY_ADDED', 'DEPENDENCY_REMOVED', 'ATTACHMENT_ADDED', 'WATCHER_ADDED', 'COMPLETED', 'ARCHIVED');

-- CreateTable MarketingTask
CREATE TABLE "MarketingTask" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "campaignId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "MarketingTaskType" NOT NULL DEFAULT 'GENERAL',
    "status" "MarketingTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "MarketingTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "assigneeUserId" TEXT,
    "reporterUserId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "templateId" TEXT,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "MarketingTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingTask_organisationId_brandId_status_idx" ON "MarketingTask"("organisationId", "brandId", "status");
CREATE INDEX "MarketingTask_organisationId_assigneeUserId_status_idx" ON "MarketingTask"("organisationId", "assigneeUserId", "status");
CREATE INDEX "MarketingTask_organisationId_reporterUserId_idx" ON "MarketingTask"("organisationId", "reporterUserId");
CREATE INDEX "MarketingTask_campaignId_idx" ON "MarketingTask"("campaignId");
CREATE INDEX "MarketingTask_sourceEntityType_sourceEntityId_idx" ON "MarketingTask"("sourceEntityType", "sourceEntityId");
CREATE INDEX "MarketingTask_dueAt_idx" ON "MarketingTask"("dueAt");
CREATE INDEX "MarketingTask_archivedAt_idx" ON "MarketingTask"("archivedAt");
CREATE INDEX "MarketingTask_isTemplate_idx" ON "MarketingTask"("isTemplate");

-- CreateTable MarketingTaskDependency
CREATE TABLE "MarketingTaskDependency" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "dependsOnTaskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingTaskDependency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingTaskDependency_taskId_dependsOnTaskId_key" ON "MarketingTaskDependency"("taskId", "dependsOnTaskId");
CREATE INDEX "MarketingTaskDependency_organisationId_idx" ON "MarketingTaskDependency"("organisationId");
CREATE INDEX "MarketingTaskDependency_dependsOnTaskId_idx" ON "MarketingTaskDependency"("dependsOnTaskId");

-- CreateTable MarketingTaskComment
CREATE TABLE "MarketingTaskComment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingTaskComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingTaskComment_organisationId_idx" ON "MarketingTaskComment"("organisationId");
CREATE INDEX "MarketingTaskComment_taskId_createdAt_idx" ON "MarketingTaskComment"("taskId", "createdAt");

-- CreateTable MarketingTaskAttachment
CREATE TABLE "MarketingTaskAttachment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingTaskAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingTaskAttachment_organisationId_idx" ON "MarketingTaskAttachment"("organisationId");
CREATE INDEX "MarketingTaskAttachment_taskId_idx" ON "MarketingTaskAttachment"("taskId");

-- CreateTable MarketingTaskWatcher
CREATE TABLE "MarketingTaskWatcher" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingTaskWatcher_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingTaskWatcher_taskId_userId_key" ON "MarketingTaskWatcher"("taskId", "userId");
CREATE INDEX "MarketingTaskWatcher_organisationId_idx" ON "MarketingTaskWatcher"("organisationId");
CREATE INDEX "MarketingTaskWatcher_userId_idx" ON "MarketingTaskWatcher"("userId");

-- CreateTable MarketingTaskChecklistItem
CREATE TABLE "MarketingTaskChecklistItem" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completedByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingTaskChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingTaskChecklistItem_organisationId_idx" ON "MarketingTaskChecklistItem"("organisationId");
CREATE INDEX "MarketingTaskChecklistItem_taskId_sortOrder_idx" ON "MarketingTaskChecklistItem"("taskId", "sortOrder");

-- CreateTable MarketingTaskActivity
CREATE TABLE "MarketingTaskActivity" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "activityType" "MarketingTaskActivityType" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingTaskActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingTaskActivity_organisationId_taskId_createdAt_idx" ON "MarketingTaskActivity"("organisationId", "taskId", "createdAt");
CREATE INDEX "MarketingTaskActivity_taskId_createdAt_idx" ON "MarketingTaskActivity"("taskId", "createdAt");

-- CreateTable MarketingApprovalRequest
CREATE TABLE "MarketingApprovalRequest" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "type" "MarketingApprovalType" NOT NULL,
    "status" "MarketingApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requesterUserId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingApprovalRequest_organisationId_brandId_status_idx" ON "MarketingApprovalRequest"("organisationId", "brandId", "status");
CREATE INDEX "MarketingApprovalRequest_organisationId_requesterUserId_idx" ON "MarketingApprovalRequest"("organisationId", "requesterUserId");
CREATE INDEX "MarketingApprovalRequest_entityType_entityId_idx" ON "MarketingApprovalRequest"("entityType", "entityId");
CREATE INDEX "MarketingApprovalRequest_status_idx" ON "MarketingApprovalRequest"("status");

-- CreateTable MarketingApprovalDecision
CREATE TABLE "MarketingApprovalDecision" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "approvalRequestId" TEXT NOT NULL,
    "decision" "MarketingApprovalStatus" NOT NULL,
    "deciderUserId" TEXT NOT NULL,
    "feedback" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingApprovalDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingApprovalDecision_organisationId_idx" ON "MarketingApprovalDecision"("organisationId");
CREATE INDEX "MarketingApprovalDecision_approvalRequestId_idx" ON "MarketingApprovalDecision"("approvalRequestId");
CREATE INDEX "MarketingApprovalDecision_deciderUserId_idx" ON "MarketingApprovalDecision"("deciderUserId");

-- AddForeignKey
ALTER TABLE "MarketingTask" ADD CONSTRAINT "MarketingTask_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingTask" ADD CONSTRAINT "MarketingTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingTask" ADD CONSTRAINT "MarketingTask_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingTask" ADD CONSTRAINT "MarketingTask_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ContentCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingTask" ADD CONSTRAINT "MarketingTask_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingTask" ADD CONSTRAINT "MarketingTask_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketingTask" ADD CONSTRAINT "MarketingTask_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MarketingTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingTaskDependency" ADD CONSTRAINT "MarketingTaskDependency_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingTaskDependency" ADD CONSTRAINT "MarketingTaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "MarketingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingTaskDependency" ADD CONSTRAINT "MarketingTaskDependency_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "MarketingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingTaskComment" ADD CONSTRAINT "MarketingTaskComment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingTaskComment" ADD CONSTRAINT "MarketingTaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "MarketingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingTaskComment" ADD CONSTRAINT "MarketingTaskComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketingTaskAttachment" ADD CONSTRAINT "MarketingTaskAttachment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingTaskAttachment" ADD CONSTRAINT "MarketingTaskAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "MarketingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingTaskAttachment" ADD CONSTRAINT "MarketingTaskAttachment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketingTaskWatcher" ADD CONSTRAINT "MarketingTaskWatcher_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingTaskWatcher" ADD CONSTRAINT "MarketingTaskWatcher_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "MarketingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingTaskWatcher" ADD CONSTRAINT "MarketingTaskWatcher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingTaskChecklistItem" ADD CONSTRAINT "MarketingTaskChecklistItem_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingTaskChecklistItem" ADD CONSTRAINT "MarketingTaskChecklistItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "MarketingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingTaskChecklistItem" ADD CONSTRAINT "MarketingTaskChecklistItem_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingTaskActivity" ADD CONSTRAINT "MarketingTaskActivity_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingTaskActivity" ADD CONSTRAINT "MarketingTaskActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "MarketingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingTaskActivity" ADD CONSTRAINT "MarketingTaskActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketingApprovalRequest" ADD CONSTRAINT "MarketingApprovalRequest_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingApprovalRequest" ADD CONSTRAINT "MarketingApprovalRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingApprovalRequest" ADD CONSTRAINT "MarketingApprovalRequest_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingApprovalRequest" ADD CONSTRAINT "MarketingApprovalRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketingApprovalDecision" ADD CONSTRAINT "MarketingApprovalDecision_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingApprovalDecision" ADD CONSTRAINT "MarketingApprovalDecision_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "MarketingApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingApprovalDecision" ADD CONSTRAINT "MarketingApprovalDecision_deciderUserId_fkey" FOREIGN KEY ("deciderUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
