-- Task 2.18: Team content operations

CREATE TYPE "ContentTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ContentCampaignStatus" AS ENUM ('PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ContentAssignmentRole" AS ENUM ('CONTENT_OWNER', 'COPY_REVIEWER', 'VISUAL_DESIGNER', 'COMPLIANCE_REVIEWER', 'PUBLISHER', 'INBOX_OWNER');
CREATE TYPE "ContentDeadlineType" AS ENUM ('CONTENT_DUE', 'REVIEW_DEADLINE', 'APPROVAL_DEADLINE', 'PUBLISHING_DEADLINE');
CREATE TYPE "ContentDeadlineStatus" AS ENUM ('UPCOMING', 'DUE_SOON', 'OVERDUE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ContentActivityType" AS ENUM (
  'ASSIGNMENT_CHANGED',
  'COMMENT',
  'STATUS_TRANSITION',
  'APPROVAL',
  'SCHEDULING_CHANGE',
  'PUBLISHING_RESULT',
  'COMPLIANCE_RESOLVED',
  'CHECKLIST_UPDATED',
  'DEADLINE_SET',
  'TASK_UPDATED',
  'CAMPAIGN_UPDATED'
);

ALTER TABLE "ContentItem" ADD COLUMN "contentCampaignId" TEXT;

ALTER TABLE "GrowthExperiment" ADD COLUMN "contentCampaignId" TEXT;

CREATE TABLE "ContentCampaign" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "objective" TEXT,
  "description" TEXT,
  "ownerUserId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "targetPlatforms" "SocialProvider"[] DEFAULT ARRAY[]::"SocialProvider"[],
  "targetAudienceId" TEXT,
  "offerId" TEXT,
  "landingPageUrl" TEXT,
  "status" "ContentCampaignStatus" NOT NULL DEFAULT 'PLANNED',
  "marketingObjectiveId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "ContentCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignMember" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "CampaignMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentTask" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "campaignId" TEXT,
  "contentItemId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "ContentTaskStatus" NOT NULL DEFAULT 'TODO',
  "assigneeUserId" TEXT,
  "ownerUserId" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3),
  "priority" "ContentPriority" NOT NULL DEFAULT 'NORMAL',
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentAssignment" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "campaignId" TEXT,
  "contentItemId" TEXT,
  "taskId" TEXT,
  "userId" TEXT NOT NULL,
  "role" "ContentAssignmentRole" NOT NULL,
  "assignedByUserId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "ContentAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentDeadline" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "campaignId" TEXT,
  "contentItemId" TEXT,
  "taskId" TEXT,
  "deadlineType" "ContentDeadlineType" NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" "ContentDeadlineStatus" NOT NULL DEFAULT 'UPCOMING',
  "reminderSentAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentDeadline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentChecklist" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "campaignId" TEXT,
  "contentItemId" TEXT,
  "taskId" TEXT,
  "name" TEXT NOT NULL,
  "isTemplate" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentChecklist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentChecklistItem" (
  "id" TEXT NOT NULL,
  "checklistId" TEXT NOT NULL,
  "itemKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "isCompleted" BOOLEAN NOT NULL DEFAULT false,
  "completedByUserId" TEXT,
  "completedAt" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ContentChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentActivity" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "campaignId" TEXT,
  "contentItemId" TEXT,
  "taskId" TEXT,
  "activityType" "ContentActivityType" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignMember_campaignId_userId_key" ON "CampaignMember"("campaignId", "userId");
CREATE INDEX "CampaignMember_userId_idx" ON "CampaignMember"("userId");

CREATE INDEX "ContentCampaign_organisationId_brandId_status_idx" ON "ContentCampaign"("organisationId", "brandId", "status");
CREATE INDEX "ContentCampaign_ownerUserId_idx" ON "ContentCampaign"("ownerUserId");
CREATE INDEX "ContentCampaign_startDate_endDate_idx" ON "ContentCampaign"("startDate", "endDate");

CREATE INDEX "ContentTask_organisationId_brandId_status_idx" ON "ContentTask"("organisationId", "brandId", "status");
CREATE INDEX "ContentTask_assigneeUserId_status_idx" ON "ContentTask"("assigneeUserId", "status");
CREATE INDEX "ContentTask_campaignId_idx" ON "ContentTask"("campaignId");
CREATE INDEX "ContentTask_contentItemId_idx" ON "ContentTask"("contentItemId");
CREATE INDEX "ContentTask_dueAt_idx" ON "ContentTask"("dueAt");

CREATE INDEX "ContentAssignment_organisationId_brandId_userId_idx" ON "ContentAssignment"("organisationId", "brandId", "userId");
CREATE INDEX "ContentAssignment_contentItemId_role_idx" ON "ContentAssignment"("contentItemId", "role");
CREATE INDEX "ContentAssignment_campaignId_idx" ON "ContentAssignment"("campaignId");
CREATE INDEX "ContentAssignment_taskId_idx" ON "ContentAssignment"("taskId");

CREATE INDEX "ContentDeadline_organisationId_brandId_status_idx" ON "ContentDeadline"("organisationId", "brandId", "status");
CREATE INDEX "ContentDeadline_dueAt_idx" ON "ContentDeadline"("dueAt");
CREATE INDEX "ContentDeadline_contentItemId_idx" ON "ContentDeadline"("contentItemId");

CREATE INDEX "ContentChecklist_organisationId_brandId_idx" ON "ContentChecklist"("organisationId", "brandId");
CREATE INDEX "ContentChecklist_contentItemId_idx" ON "ContentChecklist"("contentItemId");

CREATE UNIQUE INDEX "ContentChecklistItem_checklistId_itemKey_key" ON "ContentChecklistItem"("checklistId", "itemKey");
CREATE INDEX "ContentChecklistItem_checklistId_sortOrder_idx" ON "ContentChecklistItem"("checklistId", "sortOrder");

CREATE INDEX "ContentActivity_organisationId_brandId_createdAt_idx" ON "ContentActivity"("organisationId", "brandId", "createdAt");
CREATE INDEX "ContentActivity_campaignId_createdAt_idx" ON "ContentActivity"("campaignId", "createdAt");
CREATE INDEX "ContentActivity_contentItemId_createdAt_idx" ON "ContentActivity"("contentItemId", "createdAt");
CREATE INDEX "ContentActivity_taskId_createdAt_idx" ON "ContentActivity"("taskId", "createdAt");

CREATE INDEX "ContentItem_contentCampaignId_idx" ON "ContentItem"("contentCampaignId");
CREATE INDEX "GrowthExperiment_contentCampaignId_idx" ON "GrowthExperiment"("contentCampaignId");

ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_contentCampaignId_fkey" FOREIGN KEY ("contentCampaignId") REFERENCES "ContentCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GrowthExperiment" ADD CONSTRAINT "GrowthExperiment_contentCampaignId_fkey" FOREIGN KEY ("contentCampaignId") REFERENCES "ContentCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContentCampaign" ADD CONSTRAINT "ContentCampaign_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentCampaign" ADD CONSTRAINT "ContentCampaign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentCampaign" ADD CONSTRAINT "ContentCampaign_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentCampaign" ADD CONSTRAINT "ContentCampaign_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentCampaign" ADD CONSTRAINT "ContentCampaign_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentCampaign" ADD CONSTRAINT "ContentCampaign_targetAudienceId_fkey" FOREIGN KEY ("targetAudienceId") REFERENCES "BrandAudience"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentCampaign" ADD CONSTRAINT "ContentCampaign_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "BrandOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentCampaign" ADD CONSTRAINT "ContentCampaign_marketingObjectiveId_fkey" FOREIGN KEY ("marketingObjectiveId") REFERENCES "MarketingObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampaignMember" ADD CONSTRAINT "CampaignMember_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ContentCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignMember" ADD CONSTRAINT "CampaignMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentTask" ADD CONSTRAINT "ContentTask_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentTask" ADD CONSTRAINT "ContentTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentTask" ADD CONSTRAINT "ContentTask_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentTask" ADD CONSTRAINT "ContentTask_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ContentCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentTask" ADD CONSTRAINT "ContentTask_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentTask" ADD CONSTRAINT "ContentTask_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentTask" ADD CONSTRAINT "ContentTask_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentTask" ADD CONSTRAINT "ContentTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContentAssignment" ADD CONSTRAINT "ContentAssignment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentAssignment" ADD CONSTRAINT "ContentAssignment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentAssignment" ADD CONSTRAINT "ContentAssignment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ContentCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentAssignment" ADD CONSTRAINT "ContentAssignment_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentAssignment" ADD CONSTRAINT "ContentAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ContentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentAssignment" ADD CONSTRAINT "ContentAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentAssignment" ADD CONSTRAINT "ContentAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContentDeadline" ADD CONSTRAINT "ContentDeadline_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentDeadline" ADD CONSTRAINT "ContentDeadline_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentDeadline" ADD CONSTRAINT "ContentDeadline_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ContentCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentDeadline" ADD CONSTRAINT "ContentDeadline_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentDeadline" ADD CONSTRAINT "ContentDeadline_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ContentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentChecklist" ADD CONSTRAINT "ContentChecklist_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentChecklist" ADD CONSTRAINT "ContentChecklist_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentChecklist" ADD CONSTRAINT "ContentChecklist_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ContentCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentChecklist" ADD CONSTRAINT "ContentChecklist_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentChecklist" ADD CONSTRAINT "ContentChecklist_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ContentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentChecklistItem" ADD CONSTRAINT "ContentChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "ContentChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentChecklistItem" ADD CONSTRAINT "ContentChecklistItem_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContentActivity" ADD CONSTRAINT "ContentActivity_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentActivity" ADD CONSTRAINT "ContentActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentActivity" ADD CONSTRAINT "ContentActivity_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentActivity" ADD CONSTRAINT "ContentActivity_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ContentCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentActivity" ADD CONSTRAINT "ContentActivity_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentActivity" ADD CONSTRAINT "ContentActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ContentTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentActivity" ADD CONSTRAINT "ContentActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
