-- CreateEnum
CREATE TYPE "WorkerJobType" AS ENUM ('PUBLISHING', 'TOKEN_REFRESH', 'ANALYTICS_SYNC', 'PROVIDER_SYNC', 'DAM_PROCESSING', 'SEO_CRAWL', 'AUTOMATION_EXECUTION', 'NOTIFICATION_DIGEST');

-- CreateEnum
CREATE TYPE "WorkerJobStatus" AS ENUM ('PENDING', 'SCHEDULED', 'READY', 'CLAIMED', 'RUNNING', 'RETRY_WAIT', 'SUCCEEDED', 'FAILED', 'DEAD_LETTER', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkerJobErrorCategory" AS ENUM ('RETRYABLE', 'NON_RETRYABLE', 'RATE_LIMITED', 'REAUTH_REQUIRED', 'CONFIGURATION_ERROR');

-- CreateTable
CREATE TABLE "WorkerJob" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "jobType" "WorkerJobType" NOT NULL,
    "domainRefType" TEXT NOT NULL,
    "domainRefId" TEXT NOT NULL,
    "payload" JSONB,
    "status" "WorkerJobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    "claimedBy" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCategory" "WorkerJobErrorCategory",
    "safeErrorMessage" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkerJob_idempotencyKey_key" ON "WorkerJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WorkerJob_organisationId_idx" ON "WorkerJob"("organisationId");

-- CreateIndex
CREATE INDEX "WorkerJob_jobType_status_idx" ON "WorkerJob"("jobType", "status");

-- CreateIndex
CREATE INDEX "WorkerJob_status_dueAt_idx" ON "WorkerJob"("status", "dueAt");

-- CreateIndex
CREATE INDEX "WorkerJob_status_nextRetryAt_idx" ON "WorkerJob"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "WorkerJob_status_leaseExpiresAt_idx" ON "WorkerJob"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "WorkerJob_status_scheduledAt_idx" ON "WorkerJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "WorkerJob_organisationId_jobType_status_idx" ON "WorkerJob"("organisationId", "jobType", "status");

-- AddForeignKey
ALTER TABLE "WorkerJob" ADD CONSTRAINT "WorkerJob_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
