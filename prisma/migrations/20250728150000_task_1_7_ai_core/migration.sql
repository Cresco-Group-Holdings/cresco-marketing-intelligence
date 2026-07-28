-- CreateEnum
CREATE TYPE "AIProviderName" AS ENUM ('OPENAI', 'ANTHROPIC', 'GOOGLE', 'MOCK');

-- CreateEnum
CREATE TYPE "AICapability" AS ENUM ('TEXT_GENERATION', 'STRUCTURED_OUTPUT', 'IMAGE_GENERATION', 'AUDIO_GENERATION', 'VIDEO_GENERATION', 'EMBEDDINGS');

-- CreateEnum
CREATE TYPE "AIPurpose" AS ENUM ('DIAGNOSTICS_TEST', 'BRAND_CONTEXT_SUMMARY', 'CONTENT_DRAFT', 'SEO_ANALYSIS', 'ANALYTICS_INSIGHT', 'SALES_ASSIST');

-- CreateEnum
CREATE TYPE "AIRequestStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "AIExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "AIErrorCategory" AS ENUM ('PROVIDER_ERROR', 'VALIDATION_ERROR', 'RATE_LIMIT', 'TIMEOUT', 'CANCELLED', 'CONFIGURATION_ERROR', 'SAFETY_FILTER', 'BUDGET_EXCEEDED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PromptTemplateVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "AIRequest" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "userProfileId" TEXT NOT NULL,
    "purpose" "AIPurpose" NOT NULL,
    "provider" "AIProviderName" NOT NULL,
    "model" TEXT NOT NULL,
    "status" "AIRequestStatus" NOT NULL DEFAULT 'PENDING',
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCostUsd" DECIMAL(12,6),
    "latencyMs" INTEGER,
    "requestId" TEXT,
    "errorCategory" "AIErrorCategory",
    "inputDigest" TEXT,
    "inputPreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AIRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIExecution" (
    "id" TEXT NOT NULL,
    "aiRequestId" TEXT NOT NULL,
    "provider" "AIProviderName" NOT NULL,
    "model" TEXT NOT NULL,
    "status" "AIExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "latencyMs" INTEGER,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCostUsd" DECIMAL(12,6),
    "outputDigest" TEXT,
    "outputPreview" TEXT,
    "structuredOutput" JSONB,
    "errorCategory" "AIErrorCategory",
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AIExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsageRecord" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "userProfileId" TEXT,
    "aiRequestId" TEXT,
    "aiExecutionId" TEXT,
    "provider" "AIProviderName" NOT NULL,
    "model" TEXT NOT NULL,
    "purpose" "AIPurpose" NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DECIMAL(12,6),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "purpose" "AIPurpose" NOT NULL,
    "activeVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplateVersion" (
    "id" TEXT NOT NULL,
    "promptTemplateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "outputSchemaKey" TEXT,
    "status" "PromptTemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_key_key" ON "PromptTemplate"("key");
CREATE UNIQUE INDEX "PromptTemplate_activeVersionId_key" ON "PromptTemplate"("activeVersionId");
CREATE UNIQUE INDEX "PromptTemplateVersion_promptTemplateId_version_key" ON "PromptTemplateVersion"("promptTemplateId", "version");

CREATE INDEX "AIRequest_organisationId_idx" ON "AIRequest"("organisationId");
CREATE INDEX "AIRequest_projectId_idx" ON "AIRequest"("projectId");
CREATE INDEX "AIRequest_brandId_idx" ON "AIRequest"("brandId");
CREATE INDEX "AIRequest_userProfileId_idx" ON "AIRequest"("userProfileId");
CREATE INDEX "AIRequest_purpose_idx" ON "AIRequest"("purpose");
CREATE INDEX "AIRequest_status_idx" ON "AIRequest"("status");
CREATE INDEX "AIRequest_createdAt_idx" ON "AIRequest"("createdAt");
CREATE INDEX "AIRequest_requestId_idx" ON "AIRequest"("requestId");

CREATE INDEX "AIExecution_aiRequestId_idx" ON "AIExecution"("aiRequestId");
CREATE INDEX "AIExecution_status_idx" ON "AIExecution"("status");
CREATE INDEX "AIExecution_startedAt_idx" ON "AIExecution"("startedAt");

CREATE INDEX "AIUsageRecord_organisationId_idx" ON "AIUsageRecord"("organisationId");
CREATE INDEX "AIUsageRecord_userProfileId_idx" ON "AIUsageRecord"("userProfileId");
CREATE INDEX "AIUsageRecord_recordedAt_idx" ON "AIUsageRecord"("recordedAt");
CREATE INDEX "AIUsageRecord_purpose_idx" ON "AIUsageRecord"("purpose");

CREATE INDEX "PromptTemplate_organisationId_idx" ON "PromptTemplate"("organisationId");
CREATE INDEX "PromptTemplate_purpose_idx" ON "PromptTemplate"("purpose");
CREATE INDEX "PromptTemplateVersion_promptTemplateId_idx" ON "PromptTemplateVersion"("promptTemplateId");
CREATE INDEX "PromptTemplateVersion_status_idx" ON "PromptTemplateVersion"("status");

-- AddForeignKey
ALTER TABLE "AIRequest" ADD CONSTRAINT "AIRequest_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIRequest" ADD CONSTRAINT "AIRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AIRequest" ADD CONSTRAINT "AIRequest_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AIRequest" ADD CONSTRAINT "AIRequest_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AIExecution" ADD CONSTRAINT "AIExecution_aiRequestId_fkey" FOREIGN KEY ("aiRequestId") REFERENCES "AIRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIUsageRecord" ADD CONSTRAINT "AIUsageRecord_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIUsageRecord" ADD CONSTRAINT "AIUsageRecord_aiRequestId_fkey" FOREIGN KEY ("aiRequestId") REFERENCES "AIRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AIUsageRecord" ADD CONSTRAINT "AIUsageRecord_aiExecutionId_fkey" FOREIGN KEY ("aiExecutionId") REFERENCES "AIExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromptTemplate" ADD CONSTRAINT "PromptTemplate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromptTemplate" ADD CONSTRAINT "PromptTemplate_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "PromptTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromptTemplateVersion" ADD CONSTRAINT "PromptTemplateVersion_promptTemplateId_fkey" FOREIGN KEY ("promptTemplateId") REFERENCES "PromptTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromptTemplateVersion" ADD CONSTRAINT "PromptTemplateVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
