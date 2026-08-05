-- Stage 10 — AI Agent Foundation

ALTER TYPE "AIPurpose" ADD VALUE IF NOT EXISTS 'AGENT_ORCHESTRATION';

CREATE TYPE "AgentPlatformRunStatus" AS ENUM ('PENDING', 'RUNNING', 'AWAITING_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "AgentPlatformStepType" AS ENUM ('CONTEXT_BUILD', 'SAFETY_CHECK', 'QUOTA_CHECK', 'TOOL_CALL', 'MODEL_CALL', 'REDACTION', 'EVALUATION', 'PROPOSAL');
CREATE TYPE "AgentPlatformStepStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');
CREATE TYPE "AgentPlatformToolRiskLevel" AS ENUM ('READ_ONLY', 'DRAFT', 'HIGH_IMPACT');
CREATE TYPE "AgentPlatformActionStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'EXECUTED', 'CANCELLED');
CREATE TYPE "AgentPlatformApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
CREATE TYPE "AgentPlatformEvaluationResult" AS ENUM ('PASSED', 'FAILED', 'WARNING');

CREATE TABLE "AgentPlatformRun" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "campaignId" TEXT,
    "agentKey" TEXT NOT NULL,
    "status" "AgentPlatformRunStatus" NOT NULL DEFAULT 'PENDING',
    "initiatedByUserId" TEXT NOT NULL,
    "userInput" TEXT NOT NULL,
    "contextSnapshot" JSONB,
    "summary" TEXT,
    "limitations" JSONB,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DECIMAL(12,6),
    "aiRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AgentPlatformRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentPlatformRunStep" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "stepType" "AgentPlatformStepType" NOT NULL,
    "status" "AgentPlatformStepStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "inputDigest" TEXT,
    "outputDigest" TEXT,
    "metadata" JSONB,
    "latencyMs" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPlatformRunStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentPlatformToolCall" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepId" TEXT,
    "toolKey" TEXT NOT NULL,
    "riskLevel" "AgentPlatformToolRiskLevel" NOT NULL,
    "status" "AgentPlatformStepStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB NOT NULL,
    "output" JSONB,
    "errorMessage" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AgentPlatformToolCall_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentPlatformProposedAction" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "riskLevel" "AgentPlatformToolRiskLevel" NOT NULL,
    "status" "AgentPlatformActionStatus" NOT NULL DEFAULT 'PROPOSED',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentPlatformProposedAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentPlatformApproval" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "proposedActionId" TEXT,
    "status" "AgentPlatformApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT NOT NULL,
    "decidedByUserId" TEXT,
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentPlatformApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentPlatformEvaluation" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "criterionKey" TEXT NOT NULL,
    "result" "AgentPlatformEvaluationResult" NOT NULL,
    "score" DOUBLE PRECISION,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPlatformEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentPlatformQuota" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "dailyRunLimit" INTEGER NOT NULL DEFAULT 100,
    "dailyTokenLimit" INTEGER NOT NULL DEFAULT 500000,
    "dailyCostLimitUsd" DECIMAL(12,4) NOT NULL DEFAULT 25,
    "runsToday" INTEGER NOT NULL DEFAULT 0,
    "tokensToday" INTEGER NOT NULL DEFAULT 0,
    "costTodayUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentPlatformQuota_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentPlatformQuota_organisationId_key" ON "AgentPlatformQuota"("organisationId");
CREATE INDEX "AgentPlatformRun_organisationId_agentKey_createdAt_idx" ON "AgentPlatformRun"("organisationId", "agentKey", "createdAt");
CREATE INDEX "AgentPlatformRun_organisationId_status_idx" ON "AgentPlatformRun"("organisationId", "status");
CREATE INDEX "AgentPlatformRun_initiatedByUserId_idx" ON "AgentPlatformRun"("initiatedByUserId");
CREATE INDEX "AgentPlatformRunStep_runId_stepIndex_idx" ON "AgentPlatformRunStep"("runId", "stepIndex");
CREATE INDEX "AgentPlatformToolCall_runId_toolKey_idx" ON "AgentPlatformToolCall"("runId", "toolKey");
CREATE INDEX "AgentPlatformProposedAction_runId_status_idx" ON "AgentPlatformProposedAction"("runId", "status");
CREATE INDEX "AgentPlatformApproval_organisationId_status_idx" ON "AgentPlatformApproval"("organisationId", "status");
CREATE INDEX "AgentPlatformApproval_runId_idx" ON "AgentPlatformApproval"("runId");
CREATE INDEX "AgentPlatformEvaluation_runId_criterionKey_idx" ON "AgentPlatformEvaluation"("runId", "criterionKey");

ALTER TABLE "AgentPlatformRun" ADD CONSTRAINT "AgentPlatformRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentPlatformRun" ADD CONSTRAINT "AgentPlatformRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentPlatformRun" ADD CONSTRAINT "AgentPlatformRun_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentPlatformRun" ADD CONSTRAINT "AgentPlatformRun_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentPlatformRun" ADD CONSTRAINT "AgentPlatformRun_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentPlatformRunStep" ADD CONSTRAINT "AgentPlatformRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentPlatformRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentPlatformToolCall" ADD CONSTRAINT "AgentPlatformToolCall_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentPlatformRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentPlatformToolCall" ADD CONSTRAINT "AgentPlatformToolCall_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "AgentPlatformRunStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentPlatformProposedAction" ADD CONSTRAINT "AgentPlatformProposedAction_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentPlatformRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentPlatformApproval" ADD CONSTRAINT "AgentPlatformApproval_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentPlatformApproval" ADD CONSTRAINT "AgentPlatformApproval_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentPlatformRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentPlatformApproval" ADD CONSTRAINT "AgentPlatformApproval_proposedActionId_fkey" FOREIGN KEY ("proposedActionId") REFERENCES "AgentPlatformProposedAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentPlatformApproval" ADD CONSTRAINT "AgentPlatformApproval_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentPlatformApproval" ADD CONSTRAINT "AgentPlatformApproval_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentPlatformEvaluation" ADD CONSTRAINT "AgentPlatformEvaluation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentPlatformRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentPlatformQuota" ADD CONSTRAINT "AgentPlatformQuota_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
