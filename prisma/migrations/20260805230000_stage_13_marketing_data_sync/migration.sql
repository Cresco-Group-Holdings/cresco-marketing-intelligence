-- Stage 13: Marketing data integrations and synchronisation

ALTER TYPE "ProviderSyncRunStatus" ADD VALUE IF NOT EXISTS 'PARTIAL';

CREATE TYPE "ProviderSyncSchedule" AS ENUM ('MANUAL', 'HOURLY', 'EVERY_6_HOURS', 'DAILY', 'WEEKLY', 'CUSTOM');
CREATE TYPE "ProviderSyncMode" AS ENUM ('FULL', 'INCREMENTAL', 'BACKFILL', 'MANUAL', 'SCHEDULED', 'WEBHOOK', 'RETRY');
CREATE TYPE "ProviderCampaignMappingPolicy" AS ENUM (
  'EXTERNAL_ONLY',
  'LINKED_TO_INTERNAL',
  'IMPORTED_AS_INTERNAL',
  'IGNORED',
  'ARCHIVED_EXTERNALLY'
);
CREATE TYPE "ProviderSyncFailureStatus" AS ENUM ('PENDING_RETRY', 'RETRYING', 'RESOLVED', 'ABANDONED');

ALTER TABLE "ProviderSyncRun"
  ADD COLUMN IF NOT EXISTS "syncMode" "ProviderSyncMode",
  ADD COLUMN IF NOT EXISTS "recordsFailed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "partialFailure" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "resourceTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "triggeredByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "dateRangeStart" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dateRangeEnd" TIMESTAMP(3);

CREATE TABLE "ExternalResourceMapping" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "externalResourceType" TEXT NOT NULL,
  "externalResourceId" TEXT NOT NULL,
  "internalResourceType" TEXT NOT NULL,
  "internalResourceId" TEXT NOT NULL,
  "mappingPolicy" "ProviderCampaignMappingPolicy",
  "sourceUpdatedAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3) NOT NULL,
  "checksum" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalResourceMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalResourceMapping_connectionId_externalResourceType_externalResourceId_key"
  ON "ExternalResourceMapping"("connectionId", "externalResourceType", "externalResourceId");
CREATE INDEX "ExternalResourceMapping_organisationId_providerKey_idx"
  ON "ExternalResourceMapping"("organisationId", "providerKey");
CREATE INDEX "ExternalResourceMapping_internalResourceType_internalResourceId_idx"
  ON "ExternalResourceMapping"("internalResourceType", "internalResourceId");
CREATE INDEX "ExternalResourceMapping_connectionId_externalResourceType_idx"
  ON "ExternalResourceMapping"("connectionId", "externalResourceType");

ALTER TABLE "ExternalResourceMapping"
  ADD CONSTRAINT "ExternalResourceMapping_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalResourceMapping"
  ADD CONSTRAINT "ExternalResourceMapping_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "ProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProviderSyncPolicy" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "schedule" "ProviderSyncSchedule" NOT NULL DEFAULT 'MANUAL',
  "customIntervalMinutes" INTEGER,
  "resourceTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "backfillDays" INTEGER NOT NULL DEFAULT 90,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastScheduledAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderSyncPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderSyncPolicy_connectionId_key" ON "ProviderSyncPolicy"("connectionId");
CREATE INDEX "ProviderSyncPolicy_organisationId_idx" ON "ProviderSyncPolicy"("organisationId");

ALTER TABLE "ProviderSyncPolicy"
  ADD CONSTRAINT "ProviderSyncPolicy_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "ProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProviderSyncFailure" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "syncRunId" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "externalResourceId" TEXT,
  "pageCursor" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT NOT NULL,
  "status" "ProviderSyncFailureStatus" NOT NULL DEFAULT 'PENDING_RETRY',
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderSyncFailure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProviderSyncFailure_connectionId_status_idx" ON "ProviderSyncFailure"("connectionId", "status");
CREATE INDEX "ProviderSyncFailure_syncRunId_idx" ON "ProviderSyncFailure"("syncRunId");
CREATE INDEX "ProviderSyncFailure_organisationId_createdAt_idx" ON "ProviderSyncFailure"("organisationId", "createdAt");

ALTER TABLE "ProviderSyncFailure"
  ADD CONSTRAINT "ProviderSyncFailure_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "ProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderSyncFailure"
  ADD CONSTRAINT "ProviderSyncFailure_syncRunId_fkey"
  FOREIGN KEY ("syncRunId") REFERENCES "ProviderSyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
