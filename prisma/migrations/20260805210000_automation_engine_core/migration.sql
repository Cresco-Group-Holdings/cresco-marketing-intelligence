-- Stage 9: Internal automation engine core

CREATE TYPE "AutomationWorkflowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "AutomationTriggerKind" AS ENUM ('EVENT', 'SCHEDULE');
CREATE TYPE "AutomationEventType" AS ENUM (
  'CAMPAIGN_ACTIVATED',
  'CONTENT_ENTERED_REVIEW',
  'DEADLINE_APPROACHING',
  'LEAD_SCORE_THRESHOLD',
  'KPI_BELOW_TARGET',
  'MANUAL',
  'AUTOMATION_COMPLETED'
);
CREATE TYPE "AutomationActionType" AS ENUM (
  'CREATE_TASK',
  'UPDATE_CAMPAIGN_STATUS',
  'ASSIGN_USER',
  'REQUEST_APPROVAL',
  'CREATE_NOTIFICATION',
  'ADD_CRM_ACTIVITY',
  'UPDATE_LEAD_STATUS',
  'CREATE_CALENDAR_EVENT'
);
CREATE TYPE "AutomationExecutionStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'DEAD_LETTER',
  'SKIPPED',
  'DRY_RUN'
);
CREATE TYPE "AutomationStepStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'RETRYING',
  'SKIPPED'
);

CREATE TABLE "AutomationWorkflow" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AutomationWorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "activeVersionId" TEXT,
    "executionLimitPerDay" INTEGER,
    "monthlyQuota" INTEGER,
    "preventSelfTrigger" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationVersion" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "AutomationWorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "definitionHash" TEXT,
    "notes" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationTrigger" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "triggerKind" "AutomationTriggerKind" NOT NULL,
    "eventType" "AutomationEventType",
    "scheduleCron" TEXT,
    "config" JSONB,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationTrigger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationCondition" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AutomationCondition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationAction" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "actionType" "AutomationActionType" NOT NULL,
    "config" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "idempotencyKeyTemplate" TEXT,

    CONSTRAINT "AutomationAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationExecution" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" "AutomationExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "triggerEventType" "AutomationEventType",
    "triggerPayload" JSONB,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "triggerDepth" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "deadLetterAt" TIMESTAMP(3),
    "triggeredByUserId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationExecutionStep" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "status" "AutomationStepStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationExecutionStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationQuotaUsage" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationQuotaUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AutomationVersion_workflowId_versionNumber_key" ON "AutomationVersion"("workflowId", "versionNumber");
CREATE INDEX "AutomationWorkflow_organisationId_brandId_status_idx" ON "AutomationWorkflow"("organisationId", "brandId", "status");
CREATE INDEX "AutomationTrigger_versionId_idx" ON "AutomationTrigger"("versionId");
CREATE INDEX "AutomationTrigger_eventType_idx" ON "AutomationTrigger"("eventType");
CREATE INDEX "AutomationCondition_versionId_sortOrder_idx" ON "AutomationCondition"("versionId", "sortOrder");
CREATE INDEX "AutomationAction_versionId_sortOrder_idx" ON "AutomationAction"("versionId", "sortOrder");
CREATE UNIQUE INDEX "AutomationExecution_workflowId_idempotencyKey_key" ON "AutomationExecution"("workflowId", "idempotencyKey");
CREATE INDEX "AutomationExecution_organisationId_brandId_status_idx" ON "AutomationExecution"("organisationId", "brandId", "status");
CREATE INDEX "AutomationExecution_createdAt_idx" ON "AutomationExecution"("createdAt");
CREATE INDEX "AutomationExecutionStep_executionId_idx" ON "AutomationExecutionStep"("executionId");
CREATE UNIQUE INDEX "AutomationQuotaUsage_organisationId_brandId_periodStart_key" ON "AutomationQuotaUsage"("organisationId", "brandId", "periodStart");
CREATE INDEX "AutomationQuotaUsage_organisationId_brandId_idx" ON "AutomationQuotaUsage"("organisationId", "brandId");

ALTER TABLE "AutomationWorkflow" ADD CONSTRAINT "AutomationWorkflow_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationWorkflow" ADD CONSTRAINT "AutomationWorkflow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationWorkflow" ADD CONSTRAINT "AutomationWorkflow_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationWorkflow" ADD CONSTRAINT "AutomationWorkflow_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AutomationWorkflow" ADD CONSTRAINT "AutomationWorkflow_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationWorkflow" ADD CONSTRAINT "AutomationWorkflow_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "AutomationVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AutomationVersion" ADD CONSTRAINT "AutomationVersion_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "AutomationWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationTrigger" ADD CONSTRAINT "AutomationTrigger_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "AutomationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationCondition" ADD CONSTRAINT "AutomationCondition_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "AutomationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationAction" ADD CONSTRAINT "AutomationAction_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "AutomationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "AutomationWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "AutomationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AutomationExecutionStep" ADD CONSTRAINT "AutomationExecutionStep_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AutomationExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationQuotaUsage" ADD CONSTRAINT "AutomationQuotaUsage_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationQuotaUsage" ADD CONSTRAINT "AutomationQuotaUsage_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
