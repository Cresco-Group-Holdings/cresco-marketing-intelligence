-- CreateEnum
CREATE TYPE "MarketingDataProvider" AS ENUM ('GA4', 'GOOGLE_SEARCH_CONSOLE', 'GOOGLE_ADS', 'META', 'INSTAGRAM', 'LINKEDIN', 'TIKTOK', 'YOUTUBE', 'X', 'STRIPE', 'EMAIL_PROVIDER', 'CRM_PROVIDER', 'FIRST_PARTY', 'MANUAL_IMPORT', 'SOCIAL_BRIDGE');

-- CreateEnum
CREATE TYPE "MarketingDataSourceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "MarketingDataSourceCapabilityType" AS ENUM ('METRICS', 'EVENTS', 'DIMENSIONS', 'REVENUE', 'COST', 'LEADS', 'AUDIENCES', 'CONTENT', 'RAW_EXPORT');

-- CreateEnum
CREATE TYPE "MarketingDataSourceHealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RawMarketingRecordStatus" AS ENUM ('RECEIVED', 'VALIDATED', 'TRANSFORMED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RawMarketingBatchStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RawMarketingBatchSyncType" AS ENUM ('SCHEDULED', 'MANUAL', 'BACKFILL', 'WEBHOOK', 'REPROCESS');

-- CreateEnum
CREATE TYPE "RawMarketingPayloadStorageType" AS ENUM ('INLINE', 'OBJECT_STORAGE');

-- CreateEnum
CREATE TYPE "MarketingDimensionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED', 'REMOVED');

-- CreateEnum
CREATE TYPE "MarketingMetricSource" AS ENUM ('CONNECTOR', 'SOCIAL', 'MANUAL_IMPORT', 'FIRST_PARTY', 'DERIVED', 'CORRECTION');

-- CreateEnum
CREATE TYPE "MarketingMetricAggregation" AS ENUM ('SUM', 'AVG', 'MAX', 'MIN', 'COUNT', 'LAST');

-- CreateEnum
CREATE TYPE "MarketingMetricDataType" AS ENUM ('INTEGER', 'DECIMAL', 'PERCENTAGE', 'CURRENCY', 'DURATION', 'RATIO');

-- CreateEnum
CREATE TYPE "MarketingEventSource" AS ENUM ('CONNECTOR', 'FIRST_PARTY', 'MANUAL_IMPORT', 'SOCIAL');

-- CreateEnum
CREATE TYPE "MarketingIdentityType" AS ENUM ('ANONYMOUS_ID', 'USER_ID', 'EMAIL', 'PHONE', 'DEVICE_ID', 'COOKIE_ID', 'PROVIDER_ID');

-- CreateEnum
CREATE TYPE "MarketingIdentityLinkStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MarketingConversionType" AS ENUM ('GOAL', 'TRANSACTION', 'LEAD', 'SIGNUP', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DataLineageEntityType" AS ENUM ('RAW_RECORD', 'BATCH', 'DIMENSION', 'METRIC', 'EVENT', 'AGGREGATE', 'TRANSFORMATION');

-- CreateEnum
CREATE TYPE "DataTransformationRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DataQualityRuleType" AS ENUM ('COMPLETENESS', 'FRESHNESS', 'UNIQUENESS', 'RANGE', 'CONSISTENCY', 'REFERENTIAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DataQualityCheckStatus" AS ENUM ('PASSED', 'FAILED', 'WARNING', 'SKIPPED', 'ERROR');

-- CreateEnum
CREATE TYPE "DataQualityIssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DataQualityIssueStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "DataQualityResolutionAction" AS ENUM ('CORRECTED', 'SUPPRESSED', 'DEFERRED', 'FALSE_POSITIVE', 'REPROCESSED');

-- CreateEnum
CREATE TYPE "ManualImportJobStatus" AS ENUM ('DRAFT', 'UPLOADED', 'MAPPING', 'VALIDATING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ManualImportFileFormat" AS ENUM ('CSV', 'TSV', 'JSON', 'XLSX');

-- CreateEnum
CREATE TYPE "AggregateRefreshRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CurrencyRateSource" AS ENUM ('MANUAL', 'ECB', 'OPEN_EXCHANGE', 'PROVIDER');

-- CreateTable
CREATE TABLE "MarketingDataSource" (
    "id" TEXT NOT NULL,
    "provider" "MarketingDataProvider" NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "documentationUrl" TEXT,
    "status" "MarketingDataSourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingDataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingDataSourceAccount" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceId" TEXT NOT NULL,
    "connectorAccountId" TEXT,
    "externalAccountId" TEXT,
    "displayName" TEXT,
    "currency" TEXT,
    "timezone" TEXT,
    "status" "MarketingDataSourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" "RawMarketingBatchStatus",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingDataSourceAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingDataSourceCapability" (
    "id" TEXT NOT NULL,
    "marketingDataSourceId" TEXT NOT NULL,
    "capabilityType" "MarketingDataSourceCapabilityType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingDataSourceCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingDataSourceField" (
    "id" TEXT NOT NULL,
    "marketingDataSourceId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isDimension" BOOLEAN NOT NULL DEFAULT false,
    "isMetric" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingDataSourceField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingDataSourceHealth" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT NOT NULL,
    "status" "MarketingDataSourceHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "freshnessLagMinutes" INTEGER,
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingDataSourceHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawMarketingSchemaVersion" (
    "id" TEXT NOT NULL,
    "marketingDataSourceId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "schemaHash" TEXT,
    "schemaDefinition" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawMarketingSchemaVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawMarketingBatch" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT NOT NULL,
    "provider" "MarketingDataProvider" NOT NULL,
    "status" "RawMarketingBatchStatus" NOT NULL DEFAULT 'QUEUED',
    "syncType" "RawMarketingBatchSyncType" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "cursor" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledFor" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),
    "workerId" TEXT,
    "completedAt" TIMESTAMP(3),
    "backfillFrom" TIMESTAMP(3),
    "backfillTo" TIMESTAMP(3),
    "recordsReceived" INTEGER NOT NULL DEFAULT 0,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawMarketingBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawMarketingRecord" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT NOT NULL,
    "rawMarketingBatchId" TEXT,
    "schemaVersionId" TEXT,
    "provider" "MarketingDataProvider" NOT NULL,
    "providerRecordId" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "status" "RawMarketingRecordStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventTime" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "checksum" TEXT,
    "inlinePayload" JSONB,
    "payloadReferenceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawMarketingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawMarketingPayloadReference" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "storageType" "RawMarketingPayloadStorageType" NOT NULL DEFAULT 'OBJECT_STORAGE',
    "storagePath" TEXT NOT NULL,
    "byteSize" INTEGER,
    "contentType" TEXT,
    "checksum" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawMarketingPayloadReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseMarketingChannel" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT,
    "provider" "MarketingDataProvider" NOT NULL,
    "providerChannelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channelType" TEXT,
    "status" "MarketingDimensionStatus" NOT NULL DEFAULT 'ACTIVE',
    "providerMetadata" JSONB,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAccount" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT,
    "provider" "MarketingDataProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT,
    "timezone" TEXT,
    "status" "MarketingDimensionStatus" NOT NULL DEFAULT 'ACTIVE',
    "providerMetadata" JSONB,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT,
    "marketingAccountId" TEXT,
    "marketingChannelId" TEXT,
    "provider" "MarketingDataProvider" NOT NULL,
    "providerCampaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "MarketingDimensionStatus" NOT NULL DEFAULT 'ACTIVE',
    "campaignType" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budgetAmount" DECIMAL(24,6),
    "budgetCurrency" TEXT,
    "providerMetadata" JSONB,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAdGroup" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT,
    "marketingCampaignId" TEXT,
    "provider" "MarketingDataProvider" NOT NULL,
    "providerAdGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "MarketingDimensionStatus" NOT NULL DEFAULT 'ACTIVE',
    "providerMetadata" JSONB,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingAdGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAd" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT,
    "marketingAdGroupId" TEXT,
    "provider" "MarketingDataProvider" NOT NULL,
    "providerAdId" TEXT NOT NULL,
    "name" TEXT,
    "status" "MarketingDimensionStatus" NOT NULL DEFAULT 'ACTIVE',
    "adType" TEXT,
    "providerMetadata" JSONB,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingContentItem" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT,
    "marketingChannelId" TEXT,
    "provider" "MarketingDataProvider" NOT NULL,
    "providerContentId" TEXT NOT NULL,
    "title" TEXT,
    "contentType" TEXT NOT NULL,
    "url" TEXT,
    "publishedAt" TIMESTAMP(3),
    "status" "MarketingDimensionStatus" NOT NULL DEFAULT 'ACTIVE',
    "providerMetadata" JSONB,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingAudience" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT,
    "provider" "MarketingDataProvider" NOT NULL,
    "providerAudienceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "audienceSize" INTEGER,
    "status" "MarketingDimensionStatus" NOT NULL DEFAULT 'ACTIVE',
    "providerMetadata" JSONB,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingAudience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingChannelRule" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "matchPattern" TEXT NOT NULL,
    "matchField" TEXT NOT NULL,
    "targetChannel" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingChannelRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingChannelClassification" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingChannelId" TEXT NOT NULL,
    "marketingChannelRuleId" TEXT,
    "classifiedChannel" TEXT NOT NULL,
    "confidence" DECIMAL(5,4),
    "classifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "MarketingChannelClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingMetricDefinition" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "projectId" TEXT,
    "brandId" TEXT,
    "canonicalKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "dataType" "MarketingMetricDataType" NOT NULL DEFAULT 'DECIMAL',
    "aggregation" "MarketingMetricAggregation" NOT NULL DEFAULT 'SUM',
    "isCumulative" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingMetricDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingMetricMapping" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingMetricDefinitionId" TEXT NOT NULL,
    "provider" "MarketingDataProvider" NOT NULL,
    "providerMetricKey" TEXT NOT NULL,
    "providerSourceField" TEXT,
    "transformExpression" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingMetricMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingMetricObservation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT,
    "marketingMetricDefinitionId" TEXT,
    "provider" "MarketingDataProvider" NOT NULL,
    "source" "MarketingMetricSource" NOT NULL,
    "metricKey" TEXT NOT NULL,
    "metricValue" DECIMAL(24,6) NOT NULL,
    "unit" TEXT,
    "dimensions" JSONB,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "periodGrain" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "marketingChannelId" TEXT,
    "marketingAccountId" TEXT,
    "marketingCampaignId" TEXT,
    "marketingAdGroupId" TEXT,
    "marketingAdId" TEXT,
    "marketingContentItemId" TEXT,
    "providerMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingMetricObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingMetricCorrection" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT,
    "marketingMetricDefinitionId" TEXT,
    "marketingMetricObservationId" TEXT,
    "provider" "MarketingDataProvider" NOT NULL,
    "metricKey" TEXT NOT NULL,
    "originalValue" DECIMAL(24,6),
    "correctedValue" DECIMAL(24,6) NOT NULL,
    "reason" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingMetricCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingEvent" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT,
    "provider" "MarketingDataProvider" NOT NULL,
    "source" "MarketingEventSource" NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT,
    "identityId" TEXT,
    "marketingCampaignId" TEXT,
    "properties" JSONB,
    "providerMetadata" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingEventProperty" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingEventId" TEXT NOT NULL,
    "propertyKey" TEXT NOT NULL,
    "propertyValue" TEXT,
    "propertyType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingEventProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingSession" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT,
    "provider" "MarketingDataProvider" NOT NULL,
    "providerSessionId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "landingPage" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "deviceCategory" TEXT,
    "country" TEXT,
    "providerMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingIdentity" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "identityType" "MarketingIdentityType" NOT NULL,
    "identityValue" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingIdentityLink" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "fromIdentityId" TEXT NOT NULL,
    "toIdentityId" TEXT NOT NULL,
    "status" "MarketingIdentityLinkStatus" NOT NULL DEFAULT 'PENDING',
    "confidence" DECIMAL(5,4),
    "linkMethod" TEXT,
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingIdentityLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingConversionDefinition" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "provider" "MarketingDataProvider" NOT NULL,
    "conversionKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "conversionType" "MarketingConversionType" NOT NULL,
    "valueCurrency" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingConversionDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingRevenueRecord" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT,
    "marketingAccountId" TEXT,
    "provider" "MarketingDataProvider" NOT NULL,
    "providerRevenueId" TEXT NOT NULL,
    "amount" DECIMAL(24,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "recognisedAt" TIMESTAMP(3) NOT NULL,
    "attributionCampaign" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "providerMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingRevenueRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCostRecord" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT,
    "marketingAccountId" TEXT,
    "marketingCampaignId" TEXT,
    "marketingAdGroupId" TEXT,
    "marketingAdId" TEXT,
    "marketingChannelId" TEXT,
    "provider" "MarketingDataProvider" NOT NULL,
    "providerCostId" TEXT NOT NULL,
    "amount" DECIMAL(24,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "providerMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingCostRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyRate" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rate" DECIMAL(24,10) NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "source" "CurrencyRateSource" NOT NULL DEFAULT 'MANUAL',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrencyRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyConversionRecord" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "currencyRateId" TEXT NOT NULL,
    "sourceAmount" DECIMAL(24,6) NOT NULL,
    "sourceCurrency" TEXT NOT NULL,
    "targetAmount" DECIMAL(24,6) NOT NULL,
    "targetCurrency" TEXT NOT NULL,
    "convertedAt" TIMESTAMP(3) NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrencyConversionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataLineageRecord" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "entityType" "DataLineageEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "parentEntityType" "DataLineageEntityType",
    "parentEntityId" TEXT,
    "rawMarketingRecordId" TEXT,
    "transformationVersionId" TEXT,
    "metadata" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataLineageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataTransformationVersion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "definition" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataTransformationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataTransformationRun" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "rawMarketingBatchId" TEXT,
    "transformationVersionId" TEXT,
    "status" "DataTransformationRunStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT NOT NULL,
    "recordsIn" INTEGER NOT NULL DEFAULT 0,
    "recordsOut" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataTransformationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataQualityRule" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ruleType" "DataQualityRuleType" NOT NULL,
    "targetEntity" TEXT NOT NULL,
    "ruleExpression" JSONB NOT NULL,
    "severity" "DataQualityIssueSeverity" NOT NULL DEFAULT 'MEDIUM',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataQualityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataQualityCheck" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "dataQualityRuleId" TEXT NOT NULL,
    "rawMarketingBatchId" TEXT,
    "status" "DataQualityCheckStatus" NOT NULL,
    "recordsChecked" INTEGER NOT NULL DEFAULT 0,
    "issuesFound" INTEGER NOT NULL DEFAULT 0,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "DataQualityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataQualityIssue" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "dataQualityRuleId" TEXT NOT NULL,
    "dataQualityCheckId" TEXT,
    "severity" "DataQualityIssueSeverity" NOT NULL,
    "status" "DataQualityIssueStatus" NOT NULL DEFAULT 'OPEN',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "DataQualityIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataQualityResolution" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "dataQualityIssueId" TEXT NOT NULL,
    "action" "DataQualityResolutionAction" NOT NULL,
    "notes" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "DataQualityResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyMarketingAggregate" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingMetricDefinitionId" TEXT,
    "metricKey" TEXT NOT NULL,
    "aggregateDate" DATE NOT NULL,
    "dimensionKey" TEXT,
    "dimensionValue" TEXT,
    "value" DECIMAL(24,6) NOT NULL,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT,
    "metadata" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyMarketingAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AggregateRefreshRun" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" "AggregateRefreshRunStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT NOT NULL,
    "aggregateFrom" DATE NOT NULL,
    "aggregateTo" DATE NOT NULL,
    "metricsRefreshed" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AggregateRefreshRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualImportJob" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "status" "ManualImportJobStatus" NOT NULL DEFAULT 'DRAFT',
    "fileName" TEXT,
    "fileFormat" "ManualImportFileFormat" NOT NULL DEFAULT 'CSV',
    "fileSizeBytes" INTEGER,
    "rowCount" INTEGER,
    "rowsProcessed" INTEGER NOT NULL DEFAULT 0,
    "rowsFailed" INTEGER NOT NULL DEFAULT 0,
    "storagePath" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "uploadedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualImportMapping" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "manualImportJobId" TEXT NOT NULL,
    "sourceColumn" TEXT NOT NULL,
    "targetField" TEXT NOT NULL,
    "transformRule" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sampleValue" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualImportMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingDataSource_key_key" ON "MarketingDataSource"("key");

-- CreateIndex
CREATE INDEX "MarketingDataSource_provider_idx" ON "MarketingDataSource"("provider");

-- CreateIndex
CREATE INDEX "MarketingDataSource_status_idx" ON "MarketingDataSource"("status");

-- CreateIndex
CREATE INDEX "MarketingDataSourceAccount_organisationId_brandId_idx" ON "MarketingDataSourceAccount"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "MarketingDataSourceAccount_projectId_idx" ON "MarketingDataSourceAccount"("projectId");

-- CreateIndex
CREATE INDEX "MarketingDataSourceAccount_connectorAccountId_idx" ON "MarketingDataSourceAccount"("connectorAccountId");

-- CreateIndex
CREATE INDEX "MarketingDataSourceAccount_status_idx" ON "MarketingDataSourceAccount"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingDataSourceAccount_brandId_marketingDataSourceId_ex_key" ON "MarketingDataSourceAccount"("brandId", "marketingDataSourceId", "externalAccountId");

-- CreateIndex
CREATE INDEX "MarketingDataSourceCapability_marketingDataSourceId_idx" ON "MarketingDataSourceCapability"("marketingDataSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingDataSourceCapability_marketingDataSourceId_capabil_key" ON "MarketingDataSourceCapability"("marketingDataSourceId", "capabilityType");

-- CreateIndex
CREATE INDEX "MarketingDataSourceField_marketingDataSourceId_idx" ON "MarketingDataSourceField"("marketingDataSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingDataSourceField_marketingDataSourceId_fieldKey_key" ON "MarketingDataSourceField"("marketingDataSourceId", "fieldKey");

-- CreateIndex
CREATE INDEX "MarketingDataSourceHealth_organisationId_brandId_lastChecke_idx" ON "MarketingDataSourceHealth"("organisationId", "brandId", "lastCheckedAt");

-- CreateIndex
CREATE INDEX "MarketingDataSourceHealth_marketingDataSourceAccountId_last_idx" ON "MarketingDataSourceHealth"("marketingDataSourceAccountId", "lastCheckedAt");

-- CreateIndex
CREATE INDEX "MarketingDataSourceHealth_status_idx" ON "MarketingDataSourceHealth"("status");

-- CreateIndex
CREATE INDEX "RawMarketingSchemaVersion_marketingDataSourceId_isActive_idx" ON "RawMarketingSchemaVersion"("marketingDataSourceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RawMarketingSchemaVersion_marketingDataSourceId_version_key" ON "RawMarketingSchemaVersion"("marketingDataSourceId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "RawMarketingBatch_idempotencyKey_key" ON "RawMarketingBatch"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RawMarketingBatch_organisationId_brandId_idx" ON "RawMarketingBatch"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "RawMarketingBatch_marketingDataSourceAccountId_status_idx" ON "RawMarketingBatch"("marketingDataSourceAccountId", "status");

-- CreateIndex
CREATE INDEX "RawMarketingBatch_scheduledFor_idx" ON "RawMarketingBatch"("scheduledFor");

-- CreateIndex
CREATE INDEX "RawMarketingBatch_status_leaseExpiresAt_idx" ON "RawMarketingBatch"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "RawMarketingBatch_status_nextRetryAt_idx" ON "RawMarketingBatch"("status", "nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "RawMarketingRecord_idempotencyKey_key" ON "RawMarketingRecord"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RawMarketingRecord_organisationId_brandId_receivedAt_idx" ON "RawMarketingRecord"("organisationId", "brandId", "receivedAt");

-- CreateIndex
CREATE INDEX "RawMarketingRecord_rawMarketingBatchId_idx" ON "RawMarketingRecord"("rawMarketingBatchId");

-- CreateIndex
CREATE INDEX "RawMarketingRecord_provider_recordType_idx" ON "RawMarketingRecord"("provider", "recordType");

-- CreateIndex
CREATE INDEX "RawMarketingRecord_status_idx" ON "RawMarketingRecord"("status");

-- CreateIndex
CREATE INDEX "RawMarketingRecord_eventTime_idx" ON "RawMarketingRecord"("eventTime");

-- CreateIndex
CREATE UNIQUE INDEX "RawMarketingRecord_marketingDataSourceAccountId_providerRec_key" ON "RawMarketingRecord"("marketingDataSourceAccountId", "providerRecordId", "recordType");

-- CreateIndex
CREATE INDEX "RawMarketingPayloadReference_organisationId_brandId_idx" ON "RawMarketingPayloadReference"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "RawMarketingPayloadReference_storagePath_idx" ON "RawMarketingPayloadReference"("storagePath");

-- CreateIndex
CREATE INDEX "MarketingChannel_organisationId_brandId_idx" ON "WarehouseMarketingChannel"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "MarketingChannel_marketingDataSourceAccountId_idx" ON "WarehouseMarketingChannel"("marketingDataSourceAccountId");

-- CreateIndex
CREATE INDEX "MarketingChannel_status_idx" ON "WarehouseMarketingChannel"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingChannel_brandId_provider_providerChannelId_key" ON "WarehouseMarketingChannel"("brandId", "provider", "providerChannelId");

-- CreateIndex
CREATE INDEX "MarketingAccount_organisationId_brandId_idx" ON "MarketingAccount"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "MarketingAccount_marketingDataSourceAccountId_idx" ON "MarketingAccount"("marketingDataSourceAccountId");

-- CreateIndex
CREATE INDEX "MarketingAccount_status_idx" ON "MarketingAccount"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAccount_brandId_provider_providerAccountId_key" ON "MarketingAccount"("brandId", "provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "MarketingCampaign_organisationId_brandId_idx" ON "MarketingCampaign"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "MarketingCampaign_marketingAccountId_idx" ON "MarketingCampaign"("marketingAccountId");

-- CreateIndex
CREATE INDEX "MarketingCampaign_marketingChannelId_idx" ON "MarketingCampaign"("marketingChannelId");

-- CreateIndex
CREATE INDEX "MarketingCampaign_status_idx" ON "MarketingCampaign"("status");

-- CreateIndex
CREATE INDEX "MarketingCampaign_startDate_endDate_idx" ON "MarketingCampaign"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingCampaign_brandId_provider_providerCampaignId_key" ON "MarketingCampaign"("brandId", "provider", "providerCampaignId");

-- CreateIndex
CREATE INDEX "MarketingAdGroup_organisationId_brandId_idx" ON "MarketingAdGroup"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "MarketingAdGroup_marketingCampaignId_idx" ON "MarketingAdGroup"("marketingCampaignId");

-- CreateIndex
CREATE INDEX "MarketingAdGroup_status_idx" ON "MarketingAdGroup"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAdGroup_brandId_provider_providerAdGroupId_key" ON "MarketingAdGroup"("brandId", "provider", "providerAdGroupId");

-- CreateIndex
CREATE INDEX "MarketingAd_organisationId_brandId_idx" ON "MarketingAd"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "MarketingAd_marketingAdGroupId_idx" ON "MarketingAd"("marketingAdGroupId");

-- CreateIndex
CREATE INDEX "MarketingAd_status_idx" ON "MarketingAd"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAd_brandId_provider_providerAdId_key" ON "MarketingAd"("brandId", "provider", "providerAdId");

-- CreateIndex
CREATE INDEX "MarketingContentItem_organisationId_brandId_idx" ON "MarketingContentItem"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "MarketingContentItem_marketingChannelId_idx" ON "MarketingContentItem"("marketingChannelId");

-- CreateIndex
CREATE INDEX "MarketingContentItem_publishedAt_idx" ON "MarketingContentItem"("publishedAt");

-- CreateIndex
CREATE INDEX "MarketingContentItem_status_idx" ON "MarketingContentItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingContentItem_brandId_provider_providerContentId_key" ON "MarketingContentItem"("brandId", "provider", "providerContentId");

-- CreateIndex
CREATE INDEX "MarketingAudience_organisationId_brandId_idx" ON "MarketingAudience"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "MarketingAudience_status_idx" ON "MarketingAudience"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAudience_brandId_provider_providerAudienceId_key" ON "MarketingAudience"("brandId", "provider", "providerAudienceId");

-- CreateIndex
CREATE INDEX "MarketingChannelRule_organisationId_brandId_isActive_idx" ON "MarketingChannelRule"("organisationId", "brandId", "isActive");

-- CreateIndex
CREATE INDEX "MarketingChannelRule_priority_idx" ON "MarketingChannelRule"("priority");

-- CreateIndex
CREATE INDEX "MarketingChannelClassification_organisationId_brandId_idx" ON "MarketingChannelClassification"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "MarketingChannelClassification_marketingChannelId_idx" ON "MarketingChannelClassification"("marketingChannelId");

-- CreateIndex
CREATE INDEX "MarketingChannelClassification_classifiedChannel_idx" ON "MarketingChannelClassification"("classifiedChannel");

-- CreateIndex
CREATE INDEX "MarketingMetricDefinition_organisationId_brandId_idx" ON "MarketingMetricDefinition"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "MarketingMetricDefinition_canonicalKey_idx" ON "MarketingMetricDefinition"("canonicalKey");

-- CreateIndex
CREATE INDEX "MarketingMetricDefinition_isActive_idx" ON "MarketingMetricDefinition"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingMetricDefinition_brandId_canonicalKey_key" ON "MarketingMetricDefinition"("brandId", "canonicalKey");

-- CreateIndex
CREATE INDEX "MarketingMetricMapping_organisationId_brandId_idx" ON "MarketingMetricMapping"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "MarketingMetricMapping_marketingMetricDefinitionId_idx" ON "MarketingMetricMapping"("marketingMetricDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingMetricMapping_brandId_provider_providerMetricKey_key" ON "MarketingMetricMapping"("brandId", "provider", "providerMetricKey");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingMetricObservation_idempotencyKey_key" ON "MarketingMetricObservation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MarketingMetricObservation_organisationId_brandId_observedA_idx" ON "MarketingMetricObservation"("organisationId", "brandId", "observedAt");

-- CreateIndex
CREATE INDEX "MarketingMetricObservation_provider_metricKey_observedAt_idx" ON "MarketingMetricObservation"("provider", "metricKey", "observedAt");

-- CreateIndex
CREATE INDEX "MarketingMetricObservation_marketingMetricDefinitionId_obse_idx" ON "MarketingMetricObservation"("marketingMetricDefinitionId", "observedAt");

-- CreateIndex
CREATE INDEX "MarketingMetricObservation_marketingCampaignId_idx" ON "MarketingMetricObservation"("marketingCampaignId");

-- CreateIndex
CREATE INDEX "MarketingMetricObservation_marketingChannelId_idx" ON "MarketingMetricObservation"("marketingChannelId");

-- CreateIndex
CREATE INDEX "MarketingMetricObservation_source_idx" ON "MarketingMetricObservation"("source");

-- CreateIndex
CREATE INDEX "MarketingMetricCorrection_organisationId_brandId_observedAt_idx" ON "MarketingMetricCorrection"("organisationId", "brandId", "observedAt");

-- CreateIndex
CREATE INDEX "MarketingMetricCorrection_marketingMetricObservationId_idx" ON "MarketingMetricCorrection"("marketingMetricObservationId");

-- CreateIndex
CREATE INDEX "MarketingMetricCorrection_metricKey_idx" ON "MarketingMetricCorrection"("metricKey");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingEvent_idempotencyKey_key" ON "MarketingEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MarketingEvent_organisationId_brandId_occurredAt_idx" ON "MarketingEvent"("organisationId", "brandId", "occurredAt");

-- CreateIndex
CREATE INDEX "MarketingEvent_eventName_occurredAt_idx" ON "MarketingEvent"("eventName", "occurredAt");

-- CreateIndex
CREATE INDEX "MarketingEvent_sessionId_idx" ON "MarketingEvent"("sessionId");

-- CreateIndex
CREATE INDEX "MarketingEvent_identityId_idx" ON "MarketingEvent"("identityId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingEvent_brandId_provider_providerEventId_key" ON "MarketingEvent"("brandId", "provider", "providerEventId");

-- CreateIndex
CREATE INDEX "MarketingEventProperty_organisationId_brandId_idx" ON "MarketingEventProperty"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "MarketingEventProperty_propertyKey_idx" ON "MarketingEventProperty"("propertyKey");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingEventProperty_marketingEventId_propertyKey_key" ON "MarketingEventProperty"("marketingEventId", "propertyKey");

-- CreateIndex
CREATE INDEX "MarketingSession_organisationId_brandId_startedAt_idx" ON "MarketingSession"("organisationId", "brandId", "startedAt");

-- CreateIndex
CREATE INDEX "MarketingSession_utmSource_utmMedium_utmCampaign_idx" ON "MarketingSession"("utmSource", "utmMedium", "utmCampaign");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingSession_brandId_provider_providerSessionId_key" ON "MarketingSession"("brandId", "provider", "providerSessionId");

-- CreateIndex
CREATE INDEX "MarketingIdentity_organisationId_brandId_idx" ON "MarketingIdentity"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "MarketingIdentity_identityType_idx" ON "MarketingIdentity"("identityType");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingIdentity_brandId_identityType_identityValue_key" ON "MarketingIdentity"("brandId", "identityType", "identityValue");

-- CreateIndex
CREATE INDEX "MarketingIdentityLink_organisationId_brandId_status_idx" ON "MarketingIdentityLink"("organisationId", "brandId", "status");

-- CreateIndex
CREATE INDEX "MarketingIdentityLink_confirmedByUserId_idx" ON "MarketingIdentityLink"("confirmedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingIdentityLink_fromIdentityId_toIdentityId_key" ON "MarketingIdentityLink"("fromIdentityId", "toIdentityId");

-- CreateIndex
CREATE INDEX "MarketingConversionDefinition_organisationId_brandId_idx" ON "MarketingConversionDefinition"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "MarketingConversionDefinition_isActive_idx" ON "MarketingConversionDefinition"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingConversionDefinition_brandId_provider_conversionKe_key" ON "MarketingConversionDefinition"("brandId", "provider", "conversionKey");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingRevenueRecord_idempotencyKey_key" ON "MarketingRevenueRecord"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MarketingRevenueRecord_organisationId_brandId_recognisedAt_idx" ON "MarketingRevenueRecord"("organisationId", "brandId", "recognisedAt");

-- CreateIndex
CREATE INDEX "MarketingRevenueRecord_currency_idx" ON "MarketingRevenueRecord"("currency");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingRevenueRecord_brandId_provider_providerRevenueId_key" ON "MarketingRevenueRecord"("brandId", "provider", "providerRevenueId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingCostRecord_idempotencyKey_key" ON "MarketingCostRecord"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MarketingCostRecord_organisationId_brandId_periodStart_idx" ON "MarketingCostRecord"("organisationId", "brandId", "periodStart");

-- CreateIndex
CREATE INDEX "MarketingCostRecord_marketingCampaignId_idx" ON "MarketingCostRecord"("marketingCampaignId");

-- CreateIndex
CREATE INDEX "MarketingCostRecord_currency_idx" ON "MarketingCostRecord"("currency");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingCostRecord_brandId_provider_providerCostId_key" ON "MarketingCostRecord"("brandId", "provider", "providerCostId");

-- CreateIndex
CREATE INDEX "CurrencyRate_organisationId_idx" ON "CurrencyRate"("organisationId");

-- CreateIndex
CREATE INDEX "CurrencyRate_effectiveDate_idx" ON "CurrencyRate"("effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "CurrencyRate_baseCurrency_quoteCurrency_effectiveDate_sourc_key" ON "CurrencyRate"("baseCurrency", "quoteCurrency", "effectiveDate", "source");

-- CreateIndex
CREATE INDEX "CurrencyConversionRecord_organisationId_brandId_convertedAt_idx" ON "CurrencyConversionRecord"("organisationId", "brandId", "convertedAt");

-- CreateIndex
CREATE INDEX "CurrencyConversionRecord_entityType_entityId_idx" ON "CurrencyConversionRecord"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "CurrencyConversionRecord_currencyRateId_idx" ON "CurrencyConversionRecord"("currencyRateId");

-- CreateIndex
CREATE INDEX "DataLineageRecord_organisationId_brandId_recordedAt_idx" ON "DataLineageRecord"("organisationId", "brandId", "recordedAt");

-- CreateIndex
CREATE INDEX "DataLineageRecord_entityType_entityId_idx" ON "DataLineageRecord"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "DataLineageRecord_parentEntityType_parentEntityId_idx" ON "DataLineageRecord"("parentEntityType", "parentEntityId");

-- CreateIndex
CREATE INDEX "DataLineageRecord_rawMarketingRecordId_idx" ON "DataLineageRecord"("rawMarketingRecordId");

-- CreateIndex
CREATE INDEX "DataTransformationVersion_isActive_idx" ON "DataTransformationVersion"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DataTransformationVersion_name_version_key" ON "DataTransformationVersion"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "DataTransformationRun_idempotencyKey_key" ON "DataTransformationRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DataTransformationRun_organisationId_brandId_idx" ON "DataTransformationRun"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "DataTransformationRun_rawMarketingBatchId_idx" ON "DataTransformationRun"("rawMarketingBatchId");

-- CreateIndex
CREATE INDEX "DataTransformationRun_status_idx" ON "DataTransformationRun"("status");

-- CreateIndex
CREATE INDEX "DataQualityRule_organisationId_brandId_isActive_idx" ON "DataQualityRule"("organisationId", "brandId", "isActive");

-- CreateIndex
CREATE INDEX "DataQualityRule_ruleType_idx" ON "DataQualityRule"("ruleType");

-- CreateIndex
CREATE INDEX "DataQualityCheck_organisationId_brandId_checkedAt_idx" ON "DataQualityCheck"("organisationId", "brandId", "checkedAt");

-- CreateIndex
CREATE INDEX "DataQualityCheck_dataQualityRuleId_idx" ON "DataQualityCheck"("dataQualityRuleId");

-- CreateIndex
CREATE INDEX "DataQualityCheck_status_idx" ON "DataQualityCheck"("status");

-- CreateIndex
CREATE INDEX "DataQualityIssue_organisationId_brandId_status_idx" ON "DataQualityIssue"("organisationId", "brandId", "status");

-- CreateIndex
CREATE INDEX "DataQualityIssue_dataQualityRuleId_idx" ON "DataQualityIssue"("dataQualityRuleId");

-- CreateIndex
CREATE INDEX "DataQualityIssue_severity_idx" ON "DataQualityIssue"("severity");

-- CreateIndex
CREATE INDEX "DataQualityIssue_entityType_entityId_idx" ON "DataQualityIssue"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "DataQualityResolution_organisationId_brandId_idx" ON "DataQualityResolution"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "DataQualityResolution_dataQualityIssueId_idx" ON "DataQualityResolution"("dataQualityIssueId");

-- CreateIndex
CREATE INDEX "DataQualityResolution_resolvedByUserId_idx" ON "DataQualityResolution"("resolvedByUserId");

-- CreateIndex
CREATE INDEX "DailyMarketingAggregate_organisationId_brandId_aggregateDat_idx" ON "DailyMarketingAggregate"("organisationId", "brandId", "aggregateDate");

-- CreateIndex
CREATE INDEX "DailyMarketingAggregate_metricKey_aggregateDate_idx" ON "DailyMarketingAggregate"("metricKey", "aggregateDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMarketingAggregate_brandId_metricKey_aggregateDate_dim_key" ON "DailyMarketingAggregate"("brandId", "metricKey", "aggregateDate", "dimensionKey", "dimensionValue");

-- CreateIndex
CREATE UNIQUE INDEX "AggregateRefreshRun_idempotencyKey_key" ON "AggregateRefreshRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AggregateRefreshRun_organisationId_brandId_idx" ON "AggregateRefreshRun"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "AggregateRefreshRun_status_idx" ON "AggregateRefreshRun"("status");

-- CreateIndex
CREATE INDEX "AggregateRefreshRun_aggregateFrom_aggregateTo_idx" ON "AggregateRefreshRun"("aggregateFrom", "aggregateTo");

-- CreateIndex
CREATE UNIQUE INDEX "ManualImportJob_idempotencyKey_key" ON "ManualImportJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ManualImportJob_organisationId_brandId_status_idx" ON "ManualImportJob"("organisationId", "brandId", "status");

-- CreateIndex
CREATE INDEX "ManualImportJob_createdByUserId_idx" ON "ManualImportJob"("createdByUserId");

-- CreateIndex
CREATE INDEX "ManualImportJob_createdAt_idx" ON "ManualImportJob"("createdAt");

-- CreateIndex
CREATE INDEX "ManualImportMapping_organisationId_brandId_idx" ON "ManualImportMapping"("organisationId", "brandId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualImportMapping_manualImportJobId_sourceColumn_key" ON "ManualImportMapping"("manualImportJobId", "sourceColumn");

-- AddForeignKey
ALTER TABLE "MarketingDataSourceAccount" ADD CONSTRAINT "MarketingDataSourceAccount_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingDataSourceAccount" ADD CONSTRAINT "MarketingDataSourceAccount_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingDataSourceAccount" ADD CONSTRAINT "MarketingDataSourceAccount_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingDataSourceAccount" ADD CONSTRAINT "MarketingDataSourceAccount_marketingDataSourceId_fkey" FOREIGN KEY ("marketingDataSourceId") REFERENCES "MarketingDataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingDataSourceAccount" ADD CONSTRAINT "MarketingDataSourceAccount_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "ConnectorAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingDataSourceCapability" ADD CONSTRAINT "MarketingDataSourceCapability_marketingDataSourceId_fkey" FOREIGN KEY ("marketingDataSourceId") REFERENCES "MarketingDataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingDataSourceField" ADD CONSTRAINT "MarketingDataSourceField_marketingDataSourceId_fkey" FOREIGN KEY ("marketingDataSourceId") REFERENCES "MarketingDataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingDataSourceHealth" ADD CONSTRAINT "MarketingDataSourceHealth_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingDataSourceHealth" ADD CONSTRAINT "MarketingDataSourceHealth_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingDataSourceHealth" ADD CONSTRAINT "MarketingDataSourceHealth_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingDataSourceHealth" ADD CONSTRAINT "MarketingDataSourceHealth_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMarketingSchemaVersion" ADD CONSTRAINT "RawMarketingSchemaVersion_marketingDataSourceId_fkey" FOREIGN KEY ("marketingDataSourceId") REFERENCES "MarketingDataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMarketingBatch" ADD CONSTRAINT "RawMarketingBatch_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMarketingBatch" ADD CONSTRAINT "RawMarketingBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMarketingBatch" ADD CONSTRAINT "RawMarketingBatch_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMarketingBatch" ADD CONSTRAINT "RawMarketingBatch_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMarketingRecord" ADD CONSTRAINT "RawMarketingRecord_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMarketingRecord" ADD CONSTRAINT "RawMarketingRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMarketingRecord" ADD CONSTRAINT "RawMarketingRecord_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMarketingRecord" ADD CONSTRAINT "RawMarketingRecord_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMarketingRecord" ADD CONSTRAINT "RawMarketingRecord_rawMarketingBatchId_fkey" FOREIGN KEY ("rawMarketingBatchId") REFERENCES "RawMarketingBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMarketingRecord" ADD CONSTRAINT "RawMarketingRecord_schemaVersionId_fkey" FOREIGN KEY ("schemaVersionId") REFERENCES "RawMarketingSchemaVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMarketingRecord" ADD CONSTRAINT "RawMarketingRecord_payloadReferenceId_fkey" FOREIGN KEY ("payloadReferenceId") REFERENCES "RawMarketingPayloadReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMarketingPayloadReference" ADD CONSTRAINT "RawMarketingPayloadReference_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMarketingPayloadReference" ADD CONSTRAINT "RawMarketingPayloadReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMarketingPayloadReference" ADD CONSTRAINT "RawMarketingPayloadReference_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseMarketingChannel" ADD CONSTRAINT "MarketingChannel_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseMarketingChannel" ADD CONSTRAINT "MarketingChannel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseMarketingChannel" ADD CONSTRAINT "MarketingChannel_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseMarketingChannel" ADD CONSTRAINT "MarketingChannel_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAccount" ADD CONSTRAINT "MarketingAccount_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAccount" ADD CONSTRAINT "MarketingAccount_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAccount" ADD CONSTRAINT "MarketingAccount_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAccount" ADD CONSTRAINT "MarketingAccount_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_marketingAccountId_fkey" FOREIGN KEY ("marketingAccountId") REFERENCES "MarketingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_marketingChannelId_fkey" FOREIGN KEY ("marketingChannelId") REFERENCES "WarehouseMarketingChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAdGroup" ADD CONSTRAINT "MarketingAdGroup_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAdGroup" ADD CONSTRAINT "MarketingAdGroup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAdGroup" ADD CONSTRAINT "MarketingAdGroup_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAdGroup" ADD CONSTRAINT "MarketingAdGroup_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAdGroup" ADD CONSTRAINT "MarketingAdGroup_marketingCampaignId_fkey" FOREIGN KEY ("marketingCampaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAd" ADD CONSTRAINT "MarketingAd_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAd" ADD CONSTRAINT "MarketingAd_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAd" ADD CONSTRAINT "MarketingAd_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAd" ADD CONSTRAINT "MarketingAd_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAd" ADD CONSTRAINT "MarketingAd_marketingAdGroupId_fkey" FOREIGN KEY ("marketingAdGroupId") REFERENCES "MarketingAdGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingContentItem" ADD CONSTRAINT "MarketingContentItem_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingContentItem" ADD CONSTRAINT "MarketingContentItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingContentItem" ADD CONSTRAINT "MarketingContentItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingContentItem" ADD CONSTRAINT "MarketingContentItem_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingContentItem" ADD CONSTRAINT "MarketingContentItem_marketingChannelId_fkey" FOREIGN KEY ("marketingChannelId") REFERENCES "WarehouseMarketingChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAudience" ADD CONSTRAINT "MarketingAudience_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAudience" ADD CONSTRAINT "MarketingAudience_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAudience" ADD CONSTRAINT "MarketingAudience_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingAudience" ADD CONSTRAINT "MarketingAudience_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingChannelRule" ADD CONSTRAINT "MarketingChannelRule_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingChannelRule" ADD CONSTRAINT "MarketingChannelRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingChannelRule" ADD CONSTRAINT "MarketingChannelRule_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingChannelClassification" ADD CONSTRAINT "MarketingChannelClassification_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingChannelClassification" ADD CONSTRAINT "MarketingChannelClassification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingChannelClassification" ADD CONSTRAINT "MarketingChannelClassification_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingChannelClassification" ADD CONSTRAINT "MarketingChannelClassification_marketingChannelId_fkey" FOREIGN KEY ("marketingChannelId") REFERENCES "WarehouseMarketingChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingChannelClassification" ADD CONSTRAINT "MarketingChannelClassification_marketingChannelRuleId_fkey" FOREIGN KEY ("marketingChannelRuleId") REFERENCES "MarketingChannelRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricDefinition" ADD CONSTRAINT "MarketingMetricDefinition_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricDefinition" ADD CONSTRAINT "MarketingMetricDefinition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricDefinition" ADD CONSTRAINT "MarketingMetricDefinition_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricMapping" ADD CONSTRAINT "MarketingMetricMapping_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricMapping" ADD CONSTRAINT "MarketingMetricMapping_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricMapping" ADD CONSTRAINT "MarketingMetricMapping_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricMapping" ADD CONSTRAINT "MarketingMetricMapping_marketingMetricDefinitionId_fkey" FOREIGN KEY ("marketingMetricDefinitionId") REFERENCES "MarketingMetricDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricObservation" ADD CONSTRAINT "MarketingMetricObservation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricObservation" ADD CONSTRAINT "MarketingMetricObservation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricObservation" ADD CONSTRAINT "MarketingMetricObservation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricObservation" ADD CONSTRAINT "MarketingMetricObservation_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricObservation" ADD CONSTRAINT "MarketingMetricObservation_marketingMetricDefinitionId_fkey" FOREIGN KEY ("marketingMetricDefinitionId") REFERENCES "MarketingMetricDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricObservation" ADD CONSTRAINT "MarketingMetricObservation_marketingChannelId_fkey" FOREIGN KEY ("marketingChannelId") REFERENCES "WarehouseMarketingChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricObservation" ADD CONSTRAINT "MarketingMetricObservation_marketingAccountId_fkey" FOREIGN KEY ("marketingAccountId") REFERENCES "MarketingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricObservation" ADD CONSTRAINT "MarketingMetricObservation_marketingCampaignId_fkey" FOREIGN KEY ("marketingCampaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricObservation" ADD CONSTRAINT "MarketingMetricObservation_marketingAdGroupId_fkey" FOREIGN KEY ("marketingAdGroupId") REFERENCES "MarketingAdGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricObservation" ADD CONSTRAINT "MarketingMetricObservation_marketingAdId_fkey" FOREIGN KEY ("marketingAdId") REFERENCES "MarketingAd"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricObservation" ADD CONSTRAINT "MarketingMetricObservation_marketingContentItemId_fkey" FOREIGN KEY ("marketingContentItemId") REFERENCES "MarketingContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricCorrection" ADD CONSTRAINT "MarketingMetricCorrection_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricCorrection" ADD CONSTRAINT "MarketingMetricCorrection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricCorrection" ADD CONSTRAINT "MarketingMetricCorrection_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricCorrection" ADD CONSTRAINT "MarketingMetricCorrection_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricCorrection" ADD CONSTRAINT "MarketingMetricCorrection_marketingMetricDefinitionId_fkey" FOREIGN KEY ("marketingMetricDefinitionId") REFERENCES "MarketingMetricDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingMetricCorrection" ADD CONSTRAINT "MarketingMetricCorrection_marketingMetricObservationId_fkey" FOREIGN KEY ("marketingMetricObservationId") REFERENCES "MarketingMetricObservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingEvent" ADD CONSTRAINT "MarketingEvent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingEvent" ADD CONSTRAINT "MarketingEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingEvent" ADD CONSTRAINT "MarketingEvent_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingEvent" ADD CONSTRAINT "MarketingEvent_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingEvent" ADD CONSTRAINT "MarketingEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MarketingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingEvent" ADD CONSTRAINT "MarketingEvent_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "MarketingIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingEventProperty" ADD CONSTRAINT "MarketingEventProperty_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingEventProperty" ADD CONSTRAINT "MarketingEventProperty_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingEventProperty" ADD CONSTRAINT "MarketingEventProperty_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingEventProperty" ADD CONSTRAINT "MarketingEventProperty_marketingEventId_fkey" FOREIGN KEY ("marketingEventId") REFERENCES "MarketingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingSession" ADD CONSTRAINT "MarketingSession_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingSession" ADD CONSTRAINT "MarketingSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingSession" ADD CONSTRAINT "MarketingSession_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingSession" ADD CONSTRAINT "MarketingSession_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingIdentity" ADD CONSTRAINT "MarketingIdentity_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingIdentity" ADD CONSTRAINT "MarketingIdentity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingIdentity" ADD CONSTRAINT "MarketingIdentity_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingIdentityLink" ADD CONSTRAINT "MarketingIdentityLink_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingIdentityLink" ADD CONSTRAINT "MarketingIdentityLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingIdentityLink" ADD CONSTRAINT "MarketingIdentityLink_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingIdentityLink" ADD CONSTRAINT "MarketingIdentityLink_fromIdentityId_fkey" FOREIGN KEY ("fromIdentityId") REFERENCES "MarketingIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingIdentityLink" ADD CONSTRAINT "MarketingIdentityLink_toIdentityId_fkey" FOREIGN KEY ("toIdentityId") REFERENCES "MarketingIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingIdentityLink" ADD CONSTRAINT "MarketingIdentityLink_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingConversionDefinition" ADD CONSTRAINT "MarketingConversionDefinition_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingConversionDefinition" ADD CONSTRAINT "MarketingConversionDefinition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingConversionDefinition" ADD CONSTRAINT "MarketingConversionDefinition_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingRevenueRecord" ADD CONSTRAINT "MarketingRevenueRecord_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingRevenueRecord" ADD CONSTRAINT "MarketingRevenueRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingRevenueRecord" ADD CONSTRAINT "MarketingRevenueRecord_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingRevenueRecord" ADD CONSTRAINT "MarketingRevenueRecord_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingRevenueRecord" ADD CONSTRAINT "MarketingRevenueRecord_marketingAccountId_fkey" FOREIGN KEY ("marketingAccountId") REFERENCES "MarketingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCostRecord" ADD CONSTRAINT "MarketingCostRecord_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCostRecord" ADD CONSTRAINT "MarketingCostRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCostRecord" ADD CONSTRAINT "MarketingCostRecord_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCostRecord" ADD CONSTRAINT "MarketingCostRecord_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCostRecord" ADD CONSTRAINT "MarketingCostRecord_marketingAccountId_fkey" FOREIGN KEY ("marketingAccountId") REFERENCES "MarketingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCostRecord" ADD CONSTRAINT "MarketingCostRecord_marketingCampaignId_fkey" FOREIGN KEY ("marketingCampaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCostRecord" ADD CONSTRAINT "MarketingCostRecord_marketingAdGroupId_fkey" FOREIGN KEY ("marketingAdGroupId") REFERENCES "MarketingAdGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCostRecord" ADD CONSTRAINT "MarketingCostRecord_marketingAdId_fkey" FOREIGN KEY ("marketingAdId") REFERENCES "MarketingAd"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCostRecord" ADD CONSTRAINT "MarketingCostRecord_marketingChannelId_fkey" FOREIGN KEY ("marketingChannelId") REFERENCES "WarehouseMarketingChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyRate" ADD CONSTRAINT "CurrencyRate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyConversionRecord" ADD CONSTRAINT "CurrencyConversionRecord_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyConversionRecord" ADD CONSTRAINT "CurrencyConversionRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyConversionRecord" ADD CONSTRAINT "CurrencyConversionRecord_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyConversionRecord" ADD CONSTRAINT "CurrencyConversionRecord_currencyRateId_fkey" FOREIGN KEY ("currencyRateId") REFERENCES "CurrencyRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataLineageRecord" ADD CONSTRAINT "DataLineageRecord_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataLineageRecord" ADD CONSTRAINT "DataLineageRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataLineageRecord" ADD CONSTRAINT "DataLineageRecord_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataLineageRecord" ADD CONSTRAINT "DataLineageRecord_rawMarketingRecordId_fkey" FOREIGN KEY ("rawMarketingRecordId") REFERENCES "RawMarketingRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataLineageRecord" ADD CONSTRAINT "DataLineageRecord_transformationVersionId_fkey" FOREIGN KEY ("transformationVersionId") REFERENCES "DataTransformationVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataTransformationRun" ADD CONSTRAINT "DataTransformationRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataTransformationRun" ADD CONSTRAINT "DataTransformationRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataTransformationRun" ADD CONSTRAINT "DataTransformationRun_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataTransformationRun" ADD CONSTRAINT "DataTransformationRun_rawMarketingBatchId_fkey" FOREIGN KEY ("rawMarketingBatchId") REFERENCES "RawMarketingBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataTransformationRun" ADD CONSTRAINT "DataTransformationRun_transformationVersionId_fkey" FOREIGN KEY ("transformationVersionId") REFERENCES "DataTransformationVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualityRule" ADD CONSTRAINT "DataQualityRule_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualityRule" ADD CONSTRAINT "DataQualityRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualityRule" ADD CONSTRAINT "DataQualityRule_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualityCheck" ADD CONSTRAINT "DataQualityCheck_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualityCheck" ADD CONSTRAINT "DataQualityCheck_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualityCheck" ADD CONSTRAINT "DataQualityCheck_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualityCheck" ADD CONSTRAINT "DataQualityCheck_dataQualityRuleId_fkey" FOREIGN KEY ("dataQualityRuleId") REFERENCES "DataQualityRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualityCheck" ADD CONSTRAINT "DataQualityCheck_rawMarketingBatchId_fkey" FOREIGN KEY ("rawMarketingBatchId") REFERENCES "RawMarketingBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualityIssue" ADD CONSTRAINT "DataQualityIssue_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualityIssue" ADD CONSTRAINT "DataQualityIssue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualityIssue" ADD CONSTRAINT "DataQualityIssue_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualityIssue" ADD CONSTRAINT "DataQualityIssue_dataQualityRuleId_fkey" FOREIGN KEY ("dataQualityRuleId") REFERENCES "DataQualityRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualityIssue" ADD CONSTRAINT "DataQualityIssue_dataQualityCheckId_fkey" FOREIGN KEY ("dataQualityCheckId") REFERENCES "DataQualityCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualityResolution" ADD CONSTRAINT "DataQualityResolution_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualityResolution" ADD CONSTRAINT "DataQualityResolution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualityResolution" ADD CONSTRAINT "DataQualityResolution_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualityResolution" ADD CONSTRAINT "DataQualityResolution_dataQualityIssueId_fkey" FOREIGN KEY ("dataQualityIssueId") REFERENCES "DataQualityIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataQualityResolution" ADD CONSTRAINT "DataQualityResolution_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMarketingAggregate" ADD CONSTRAINT "DailyMarketingAggregate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMarketingAggregate" ADD CONSTRAINT "DailyMarketingAggregate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMarketingAggregate" ADD CONSTRAINT "DailyMarketingAggregate_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMarketingAggregate" ADD CONSTRAINT "DailyMarketingAggregate_marketingMetricDefinitionId_fkey" FOREIGN KEY ("marketingMetricDefinitionId") REFERENCES "MarketingMetricDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AggregateRefreshRun" ADD CONSTRAINT "AggregateRefreshRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AggregateRefreshRun" ADD CONSTRAINT "AggregateRefreshRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AggregateRefreshRun" ADD CONSTRAINT "AggregateRefreshRun_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualImportJob" ADD CONSTRAINT "ManualImportJob_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualImportJob" ADD CONSTRAINT "ManualImportJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualImportJob" ADD CONSTRAINT "ManualImportJob_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualImportJob" ADD CONSTRAINT "ManualImportJob_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualImportJob" ADD CONSTRAINT "ManualImportJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualImportMapping" ADD CONSTRAINT "ManualImportMapping_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualImportMapping" ADD CONSTRAINT "ManualImportMapping_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualImportMapping" ADD CONSTRAINT "ManualImportMapping_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualImportMapping" ADD CONSTRAINT "ManualImportMapping_manualImportJobId_fkey" FOREIGN KEY ("manualImportJobId") REFERENCES "ManualImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

