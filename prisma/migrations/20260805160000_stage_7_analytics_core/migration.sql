-- Stage 7 — Canonical Analytics Data Model and Performance Core

CREATE TYPE "AnalyticsDataSourceKind" AS ENUM ('MANUAL_IMPORT', 'INTERNAL', 'CONNECTOR');
CREATE TYPE "AnalyticsDataSourceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DEPRECATED');
CREATE TYPE "AnalyticsMetricKind" AS ENUM ('BASE', 'DERIVED');
CREATE TYPE "AnalyticsMetricDataType" AS ENUM ('INTEGER', 'DECIMAL', 'PERCENTAGE', 'CURRENCY', 'RATIO');
CREATE TYPE "AnalyticsGranularity" AS ENUM ('HOUR', 'DAY', 'WEEK', 'MONTH', 'TOTAL');
CREATE TYPE "AnalyticsImportBatchStatus" AS ENUM ('PENDING', 'VALIDATING', 'COMPLETED', 'PARTIAL', 'FAILED');
CREATE TYPE "AnalyticsAttributionModelType" AS ENUM ('FIRST_TOUCH', 'LAST_TOUCH', 'LINEAR', 'POSITION_BASED', 'TIME_DECAY');
CREATE TYPE "AnalyticsGoalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "AnalyticsSnapshotStatus" AS ENUM ('DRAFT', 'FINALIZED');

CREATE TABLE "AnalyticsDataSource" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "AnalyticsDataSourceKind" NOT NULL DEFAULT 'MANUAL_IMPORT',
    "status" "AnalyticsDataSourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "providerKey" TEXT,
    "lastImportAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsDataSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsMetricDefinition" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "kind" "AnalyticsMetricKind" NOT NULL DEFAULT 'BASE',
    "dataType" "AnalyticsMetricDataType" NOT NULL,
    "unit" TEXT,
    "isCumulative" BOOLEAN NOT NULL DEFAULT false,
    "formulaKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsMetricDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsDimensionDefinition" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dimensionKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsDimensionDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsImportBatch" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "status" "AnalyticsImportBatchStatus" NOT NULL DEFAULT 'PENDING',
    "fileName" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "warnings" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsFact" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "campaignId" TEXT,
    "channel" TEXT,
    "provider" TEXT,
    "dataSourceId" TEXT,
    "metricKey" TEXT NOT NULL,
    "value" DECIMAL(24,8) NOT NULL,
    "currency" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "granularity" "AnalyticsGranularity" NOT NULL DEFAULT 'DAY',
    "dimensions" JSONB NOT NULL DEFAULT '{}',
    "sourceBatchId" TEXT,
    "dedupeFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsFact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsAttributionModel" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modelType" "AnalyticsAttributionModelType" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsAttributionModel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsGoal" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "campaignId" TEXT,
    "name" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "targetValue" DECIMAL(24,8) NOT NULL,
    "currency" TEXT,
    "status" "AnalyticsGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "campaignId" TEXT,
    "name" TEXT NOT NULL,
    "status" "AnalyticsSnapshotStatus" NOT NULL DEFAULT 'DRAFT',
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsMetricDefinition_organisationId_metricKey_key" ON "AnalyticsMetricDefinition"("organisationId", "metricKey");
CREATE INDEX "AnalyticsMetricDefinition_workspaceId_idx" ON "AnalyticsMetricDefinition"("workspaceId");

CREATE UNIQUE INDEX "AnalyticsDimensionDefinition_organisationId_dimensionKey_key" ON "AnalyticsDimensionDefinition"("organisationId", "dimensionKey");
CREATE INDEX "AnalyticsDimensionDefinition_workspaceId_idx" ON "AnalyticsDimensionDefinition"("workspaceId");

CREATE INDEX "AnalyticsDataSource_organisationId_status_idx" ON "AnalyticsDataSource"("organisationId", "status");
CREATE INDEX "AnalyticsDataSource_workspaceId_idx" ON "AnalyticsDataSource"("workspaceId");

CREATE INDEX "AnalyticsImportBatch_organisationId_status_idx" ON "AnalyticsImportBatch"("organisationId", "status");
CREATE INDEX "AnalyticsImportBatch_dataSourceId_createdAt_idx" ON "AnalyticsImportBatch"("dataSourceId", "createdAt");
CREATE INDEX "AnalyticsImportBatch_workspaceId_idx" ON "AnalyticsImportBatch"("workspaceId");

CREATE UNIQUE INDEX "AnalyticsFact_organisationId_dedupeFingerprint_key" ON "AnalyticsFact"("organisationId", "dedupeFingerprint");
CREATE INDEX "AnalyticsFact_organisationId_metricKey_occurredAt_idx" ON "AnalyticsFact"("organisationId", "metricKey", "occurredAt");
CREATE INDEX "AnalyticsFact_organisationId_campaignId_occurredAt_idx" ON "AnalyticsFact"("organisationId", "campaignId", "occurredAt");
CREATE INDEX "AnalyticsFact_organisationId_channel_occurredAt_idx" ON "AnalyticsFact"("organisationId", "channel", "occurredAt");
CREATE INDEX "AnalyticsFact_organisationId_brandId_occurredAt_idx" ON "AnalyticsFact"("organisationId", "brandId", "occurredAt");
CREATE INDEX "AnalyticsFact_workspaceId_occurredAt_idx" ON "AnalyticsFact"("workspaceId", "occurredAt");
CREATE INDEX "AnalyticsFact_sourceBatchId_idx" ON "AnalyticsFact"("sourceBatchId");

CREATE INDEX "AnalyticsAttributionModel_organisationId_isDefault_idx" ON "AnalyticsAttributionModel"("organisationId", "isDefault");
CREATE INDEX "AnalyticsAttributionModel_workspaceId_idx" ON "AnalyticsAttributionModel"("workspaceId");

CREATE INDEX "AnalyticsGoal_organisationId_status_idx" ON "AnalyticsGoal"("organisationId", "status");
CREATE INDEX "AnalyticsGoal_campaignId_idx" ON "AnalyticsGoal"("campaignId");
CREATE INDEX "AnalyticsGoal_workspaceId_idx" ON "AnalyticsGoal"("workspaceId");

CREATE INDEX "AnalyticsSnapshot_organisationId_createdAt_idx" ON "AnalyticsSnapshot"("organisationId", "createdAt");
CREATE INDEX "AnalyticsSnapshot_workspaceId_periodFrom_periodTo_idx" ON "AnalyticsSnapshot"("workspaceId", "periodFrom", "periodTo");

ALTER TABLE "AnalyticsDataSource" ADD CONSTRAINT "AnalyticsDataSource_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsMetricDefinition" ADD CONSTRAINT "AnalyticsMetricDefinition_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsDimensionDefinition" ADD CONSTRAINT "AnalyticsDimensionDefinition_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsImportBatch" ADD CONSTRAINT "AnalyticsImportBatch_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsImportBatch" ADD CONSTRAINT "AnalyticsImportBatch_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "AnalyticsDataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsFact" ADD CONSTRAINT "AnalyticsFact_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsFact" ADD CONSTRAINT "AnalyticsFact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsFact" ADD CONSTRAINT "AnalyticsFact_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsFact" ADD CONSTRAINT "AnalyticsFact_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsFact" ADD CONSTRAINT "AnalyticsFact_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "AnalyticsDataSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsFact" ADD CONSTRAINT "AnalyticsFact_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "AnalyticsImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsAttributionModel" ADD CONSTRAINT "AnalyticsAttributionModel_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsGoal" ADD CONSTRAINT "AnalyticsGoal_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsGoal" ADD CONSTRAINT "AnalyticsGoal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsGoal" ADD CONSTRAINT "AnalyticsGoal_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsGoal" ADD CONSTRAINT "AnalyticsGoal_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsSnapshot" ADD CONSTRAINT "AnalyticsSnapshot_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsSnapshot" ADD CONSTRAINT "AnalyticsSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsSnapshot" ADD CONSTRAINT "AnalyticsSnapshot_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsSnapshot" ADD CONSTRAINT "AnalyticsSnapshot_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
