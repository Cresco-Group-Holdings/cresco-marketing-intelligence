-- Add REQUIRES_REAUTH publication status and publication analytics models.

ALTER TYPE "PublicationStatus" ADD VALUE IF NOT EXISTS 'REQUIRES_REAUTH' BEFORE 'CANCELLED';

CREATE TYPE "PublicationAnalyticsSyncStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'PARTIAL',
  'FAILED',
  'RATE_LIMITED'
);

CREATE TABLE "PublicationMetric" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "publicationId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "externalPublicationId" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "metricValue" DECIMAL(18,6) NOT NULL,
  "metricPeriod" TEXT NOT NULL DEFAULT 'lifetime',
  "measuredAt" TIMESTAMP(3) NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "providerMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicationMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicationAnalyticsSync" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "publicationId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "status" "PublicationAnalyticsSyncStatus" NOT NULL DEFAULT 'QUEUED',
  "syncCursor" JSONB,
  "lastSyncedAt" TIMESTAMP(3),
  "nextSyncAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicationAnalyticsSync_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublicationMetric_idempotencyKey_key" ON "PublicationMetric"("idempotencyKey");
CREATE INDEX "PublicationMetric_publicationId_measuredAt_idx" ON "PublicationMetric"("publicationId", "measuredAt");
CREATE INDEX "PublicationMetric_organisationId_brandId_metricKey_idx" ON "PublicationMetric"("organisationId", "brandId", "metricKey");
CREATE INDEX "PublicationMetric_externalPublicationId_idx" ON "PublicationMetric"("externalPublicationId");

CREATE UNIQUE INDEX "PublicationAnalyticsSync_publicationId_key" ON "PublicationAnalyticsSync"("publicationId");
CREATE INDEX "PublicationAnalyticsSync_organisationId_status_nextSyncAt_idx" ON "PublicationAnalyticsSync"("organisationId", "status", "nextSyncAt");
CREATE INDEX "PublicationAnalyticsSync_connectionId_idx" ON "PublicationAnalyticsSync"("connectionId");

CREATE INDEX "Publication_externalPublicationId_idx" ON "Publication"("externalPublicationId");

ALTER TABLE "PublicationMetric"
  ADD CONSTRAINT "PublicationMetric_publicationId_fkey"
  FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublicationAnalyticsSync"
  ADD CONSTRAINT "PublicationAnalyticsSync_publicationId_fkey"
  FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
