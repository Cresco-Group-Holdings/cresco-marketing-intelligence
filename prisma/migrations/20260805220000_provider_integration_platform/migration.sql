-- Stage 11: Provider integration platform extensions

CREATE TYPE "ProviderSyncDirection" AS ENUM ('IMPORT', 'EXPORT');
CREATE TYPE "ProviderSyncTriggerType" AS ENUM ('MANUAL', 'SCHEDULED', 'WEBHOOK', 'EVENT', 'INITIAL_IMPORT', 'RETRY');
CREATE TYPE "ProviderSyncRecordAction" AS ENUM ('CREATED', 'UPDATED', 'SKIPPED', 'FAILED');
CREATE TYPE "ProviderWebhookEndpointStatus" AS ENUM ('PENDING', 'ACTIVE', 'FAILED', 'REVOKED');

ALTER TYPE "ProviderSyncRunStatus" ADD VALUE IF NOT EXISTS 'QUEUED';
ALTER TYPE "ProviderSyncRunStatus" ADD VALUE IF NOT EXISTS 'SUCCEEDED';
ALTER TYPE "ProviderSyncRunStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_SUCCEEDED';
ALTER TYPE "ProviderSyncRunStatus" ADD VALUE IF NOT EXISTS 'RETRYING';
ALTER TYPE "ProviderSyncRunStatus" ADD VALUE IF NOT EXISTS 'DEAD_LETTERED';

ALTER TABLE "ProviderWebhookEndpoint" ADD COLUMN IF NOT EXISTS "endpointKey" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "ProviderWebhookEndpoint" ADD COLUMN IF NOT EXISTS "status" "ProviderWebhookEndpointStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "ProviderWebhookEndpoint" ADD COLUMN IF NOT EXISTS "subscribedEvents" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ProviderWebhookEndpoint" ADD COLUMN IF NOT EXISTS "lastVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderWebhookEndpoint_connectionId_endpointKey_key"
  ON "ProviderWebhookEndpoint"("connectionId", "endpointKey");

ALTER TABLE "ProviderSyncRun" ADD COLUMN IF NOT EXISTS "capability" TEXT;
ALTER TABLE "ProviderSyncRun" ADD COLUMN IF NOT EXISTS "direction" "ProviderSyncDirection" NOT NULL DEFAULT 'IMPORT';
ALTER TABLE "ProviderSyncRun" ADD COLUMN IF NOT EXISTS "triggerType" "ProviderSyncTriggerType" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "ProviderSyncRun" ADD COLUMN IF NOT EXISTS "cursor" TEXT;
ALTER TABLE "ProviderSyncRun" ADD COLUMN IF NOT EXISTS "checkpoint" JSONB;
ALTER TABLE "ProviderSyncRun" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "ProviderSyncRun" ADD COLUMN IF NOT EXISTS "requestedByUserId" TEXT;
ALTER TABLE "ProviderSyncRun" ADD COLUMN IF NOT EXISTS "recordsRead" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProviderSyncRun" ADD COLUMN IF NOT EXISTS "recordsWritten" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProviderSyncRun" ADD COLUMN IF NOT EXISTS "recordsSkipped" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProviderSyncRun" ADD COLUMN IF NOT EXISTS "recordsFailed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProviderSyncRun" ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProviderSyncRun" ADD COLUMN IF NOT EXISTS "nextRetryAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderSyncRun_connectionId_idempotencyKey_key"
  ON "ProviderSyncRun"("connectionId", "idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "ProviderSyncRun_connectionId_capability_status_idx"
  ON "ProviderSyncRun"("connectionId", "capability", "status");

CREATE TABLE "ProviderSyncRecord" (
    "id" TEXT NOT NULL,
    "syncRunId" TEXT NOT NULL,
    "externalResourceType" TEXT NOT NULL,
    "externalResourceId" TEXT NOT NULL,
    "internalResourceType" TEXT,
    "internalResourceId" TEXT,
    "action" "ProviderSyncRecordAction" NOT NULL,
    "checksum" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderSyncRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderAccount" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "accountType" TEXT,
    "parentExternalId" TEXT,
    "currency" TEXT,
    "timezone" TEXT,
    "status" TEXT,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProviderSyncRecord_syncRunId_processedAt_idx" ON "ProviderSyncRecord"("syncRunId", "processedAt");
CREATE INDEX "ProviderSyncRecord_externalResourceType_externalResourceId_idx" ON "ProviderSyncRecord"("externalResourceType", "externalResourceId");
CREATE UNIQUE INDEX "ProviderAccount_connectionId_externalId_key" ON "ProviderAccount"("connectionId", "externalId");
CREATE INDEX "ProviderAccount_connectionId_selected_idx" ON "ProviderAccount"("connectionId", "selected");
CREATE INDEX "ProviderAccount_organisationId_idx" ON "ProviderAccount"("organisationId");

ALTER TABLE "ProviderSyncRecord" ADD CONSTRAINT "ProviderSyncRecord_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "ProviderSyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderAccount" ADD CONSTRAINT "ProviderAccount_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
