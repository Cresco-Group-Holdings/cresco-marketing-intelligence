CREATE TYPE "SocialAnalyticsSyncStatus" AS ENUM ('QUEUED','RUNNING','COMPLETED','PARTIAL','FAILED','CANCELLED');

CREATE TABLE "SocialPostMetric" ("id" TEXT PRIMARY KEY,"organisationId" TEXT NOT NULL,"projectId" TEXT NOT NULL,"brandId" TEXT NOT NULL,"socialAccountId" TEXT NOT NULL,"contentItemId" TEXT,"contentVariantId" TEXT,"provider" "SocialProvider" NOT NULL,"providerPostId" TEXT NOT NULL,"metricType" TEXT NOT NULL,"metricValue" DECIMAL(24,6) NOT NULL,"measuredAt" TIMESTAMP(3) NOT NULL,"metricPeriod" TEXT NOT NULL,"providerMetadata" JSONB,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "SocialPostMetric_observation_key" ON "SocialPostMetric"("socialAccountId","providerPostId","metricType","measuredAt","metricPeriod");
CREATE INDEX "SocialPostMetric_tenant_date_idx" ON "SocialPostMetric"("organisationId","brandId","measuredAt");
CREATE INDEX "SocialPostMetric_contentItemId_idx" ON "SocialPostMetric"("contentItemId");
CREATE INDEX "SocialPostMetric_contentVariantId_idx" ON "SocialPostMetric"("contentVariantId");
CREATE INDEX "SocialPostMetric_provider_metricType_idx" ON "SocialPostMetric"("provider","metricType");

CREATE TABLE "SocialAccountMetric" ("id" TEXT PRIMARY KEY,"organisationId" TEXT NOT NULL,"projectId" TEXT NOT NULL,"brandId" TEXT NOT NULL,"socialAccountId" TEXT NOT NULL,"provider" "SocialProvider" NOT NULL,"metricType" TEXT NOT NULL,"metricValue" DECIMAL(24,6) NOT NULL,"measuredAt" TIMESTAMP(3) NOT NULL,"metricPeriod" TEXT NOT NULL,"providerMetadata" JSONB,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "SocialAccountMetric_observation_key" ON "SocialAccountMetric"("socialAccountId","metricType","measuredAt","metricPeriod");
CREATE INDEX "SocialAccountMetric_tenant_date_idx" ON "SocialAccountMetric"("organisationId","brandId","measuredAt");
CREATE INDEX "SocialAccountMetric_provider_metricType_idx" ON "SocialAccountMetric"("provider","metricType");

CREATE TABLE "SocialMetricSnapshot" ("id" TEXT PRIMARY KEY,"organisationId" TEXT NOT NULL,"projectId" TEXT NOT NULL,"brandId" TEXT NOT NULL,"socialAccountId" TEXT NOT NULL,"provider" "SocialProvider" NOT NULL,"providerEntityId" TEXT NOT NULL,"metricScope" TEXT NOT NULL,"measuredAt" TIMESTAMP(3) NOT NULL,"idempotencyKey" TEXT NOT NULL,"providerMetadata" JSONB,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "SocialMetricSnapshot_idempotencyKey_key" ON "SocialMetricSnapshot"("idempotencyKey");
CREATE INDEX "SocialMetricSnapshot_tenant_date_idx" ON "SocialMetricSnapshot"("organisationId","brandId","measuredAt");
CREATE INDEX "SocialMetricSnapshot_account_entity_idx" ON "SocialMetricSnapshot"("socialAccountId","providerEntityId");

CREATE TABLE "SocialAnalyticsSync" ("id" TEXT PRIMARY KEY,"organisationId" TEXT NOT NULL,"projectId" TEXT NOT NULL,"brandId" TEXT NOT NULL,"socialAccountId" TEXT NOT NULL,"provider" "SocialProvider" NOT NULL,"status" "SocialAnalyticsSyncStatus" NOT NULL DEFAULT 'QUEUED',"syncType" TEXT NOT NULL,"idempotencyKey" TEXT NOT NULL,"cursor" JSONB,"attemptCount" INTEGER NOT NULL DEFAULT 0,"maxAttempts" INTEGER NOT NULL DEFAULT 3,"scheduledFor" TIMESTAMP(3),"nextRetryAt" TIMESTAMP(3),"startedAt" TIMESTAMP(3),"completedAt" TIMESTAMP(3),"postsProcessed" INTEGER NOT NULL DEFAULT 0,"metricsStored" INTEGER NOT NULL DEFAULT 0,"unavailableMetrics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],"createdByUserId" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "SocialAnalyticsSync_idempotencyKey_key" ON "SocialAnalyticsSync"("idempotencyKey");
CREATE INDEX "SocialAnalyticsSync_tenant_idx" ON "SocialAnalyticsSync"("organisationId","brandId");
CREATE INDEX "SocialAnalyticsSync_account_status_idx" ON "SocialAnalyticsSync"("socialAccountId","status");
CREATE INDEX "SocialAnalyticsSync_scheduledFor_idx" ON "SocialAnalyticsSync"("scheduledFor");

CREATE TABLE "SocialMetricDefinition" ("id" TEXT PRIMARY KEY,"canonicalName" TEXT NOT NULL,"provider" "SocialProvider" NOT NULL,"providerSourceField" TEXT NOT NULL,"unit" TEXT NOT NULL,"aggregationRule" TEXT NOT NULL,"cumulative" BOOLEAN NOT NULL,"metricScope" TEXT NOT NULL,"limitations" TEXT,"active" BOOLEAN NOT NULL DEFAULT true,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "SocialMetricDefinition_source_key" ON "SocialMetricDefinition"("provider","providerSourceField","metricScope");
CREATE INDEX "SocialMetricDefinition_canonicalName_idx" ON "SocialMetricDefinition"("canonicalName");

CREATE TABLE "SocialAnalyticsError" ("id" TEXT PRIMARY KEY,"organisationId" TEXT NOT NULL,"projectId" TEXT NOT NULL,"brandId" TEXT NOT NULL,"socialAccountId" TEXT NOT NULL,"socialAnalyticsSyncId" TEXT NOT NULL,"providerPostId" TEXT,"category" TEXT NOT NULL,"providerCode" TEXT,"message" TEXT NOT NULL,"retryable" BOOLEAN NOT NULL DEFAULT false,"providerMetadata" JSONB,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "SocialAnalyticsError_sync_idx" ON "SocialAnalyticsError"("socialAnalyticsSyncId");
CREATE INDEX "SocialAnalyticsError_tenant_idx" ON "SocialAnalyticsError"("organisationId","brandId");
