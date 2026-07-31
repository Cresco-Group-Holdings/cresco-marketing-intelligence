-- CreateEnum
CREATE TYPE "TrackingPropertyStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "TrackingDomainVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');
CREATE TYPE "TrackingEnvironmentType" AS ENUM ('PRODUCTION', 'STAGING', 'DEVELOPMENT');
CREATE TYPE "TrackingInstallationStatus" AS ENUM ('PENDING', 'ACTIVE', 'ERROR', 'DISABLED');
CREATE TYPE "TrackingApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "TrackingIngestStatus" AS ENUM ('ACCEPTED', 'QUARANTINED', 'REJECTED');
CREATE TYPE "TrackingConsentCategory" AS ENUM ('ESSENTIAL', 'ANALYTICS', 'MARKETING', 'PERSONALISATION');

-- AlterTable
ALTER TABLE "MarketingSession" ADD COLUMN IF NOT EXISTS "exitPage" TEXT;
ALTER TABLE "MarketingSession" ADD COLUMN IF NOT EXISTS "consentState" JSONB;
ALTER TABLE "MarketingSession" ADD COLUMN IF NOT EXISTS "pageViewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MarketingSession" ADD COLUMN IF NOT EXISTS "eventCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MarketingSession" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "MarketingSession" ADD COLUMN IF NOT EXISTS "medium" TEXT;
ALTER TABLE "MarketingSession" ADD COLUMN IF NOT EXISTS "campaign" TEXT;

-- CreateTable
CREATE TABLE "TrackingProperty" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publicPropertyId" TEXT NOT NULL,
    "status" "TrackingPropertyStatus" NOT NULL DEFAULT 'ACTIVE',
    "defaultTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "reportingCurrency" TEXT NOT NULL DEFAULT 'GBP',
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 30,
    "cookielessMode" BOOLEAN NOT NULL DEFAULT false,
    "sdkVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrackingProperty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrackingEnvironment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "trackingPropertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "environmentType" "TrackingEnvironmentType" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrackingEnvironment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrackingDomain" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "trackingPropertyId" TEXT NOT NULL,
    "trackingEnvironmentId" TEXT,
    "hostname" TEXT NOT NULL,
    "allowedOrigin" TEXT NOT NULL,
    "environmentType" "TrackingEnvironmentType" NOT NULL DEFAULT 'PRODUCTION',
    "verificationStatus" "TrackingDomainVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationToken" TEXT,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrackingDomain_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrackingApiKey" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "trackingPropertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "environmentType" "TrackingEnvironmentType" NOT NULL DEFAULT 'PRODUCTION',
    "status" "TrackingApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrackingApiKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrackingInstallation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "trackingPropertyId" TEXT NOT NULL,
    "trackingEnvironmentId" TEXT,
    "platform" TEXT NOT NULL,
    "sdkVersion" TEXT NOT NULL,
    "environmentType" "TrackingEnvironmentType" NOT NULL DEFAULT 'PRODUCTION',
    "status" "TrackingInstallationStatus" NOT NULL DEFAULT 'PENDING',
    "lastSeenAt" TIMESTAMP(3),
    "lastError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrackingInstallation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrackingIngestLog" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "trackingPropertyId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "status" "TrackingIngestStatus" NOT NULL DEFAULT 'ACCEPTED',
    "origin" TEXT,
    "userAgent" TEXT,
    "quarantineReason" TEXT,
    "clientTimestamp" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "marketingEventId" TEXT,
    "payloadSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackingIngestLog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "TrackingProperty_publicPropertyId_key" ON "TrackingProperty"("publicPropertyId");
CREATE INDEX "TrackingProperty_organisationId_brandId_idx" ON "TrackingProperty"("organisationId", "brandId");
CREATE INDEX "TrackingProperty_status_idx" ON "TrackingProperty"("status");

CREATE UNIQUE INDEX "TrackingDomain_trackingPropertyId_hostname_environmentType_key" ON "TrackingDomain"("trackingPropertyId", "hostname", "environmentType");
CREATE INDEX "TrackingDomain_organisationId_brandId_idx" ON "TrackingDomain"("organisationId", "brandId");
CREATE INDEX "TrackingDomain_allowedOrigin_idx" ON "TrackingDomain"("allowedOrigin");
CREATE INDEX "TrackingDomain_verificationStatus_idx" ON "TrackingDomain"("verificationStatus");

CREATE UNIQUE INDEX "TrackingEnvironment_trackingPropertyId_environmentType_key" ON "TrackingEnvironment"("trackingPropertyId", "environmentType");
CREATE INDEX "TrackingEnvironment_organisationId_brandId_idx" ON "TrackingEnvironment"("organisationId", "brandId");

CREATE UNIQUE INDEX "TrackingApiKey_keyHash_key" ON "TrackingApiKey"("keyHash");
CREATE INDEX "TrackingApiKey_trackingPropertyId_status_idx" ON "TrackingApiKey"("trackingPropertyId", "status");
CREATE INDEX "TrackingApiKey_keyPrefix_idx" ON "TrackingApiKey"("keyPrefix");

CREATE INDEX "TrackingInstallation_organisationId_brandId_status_idx" ON "TrackingInstallation"("organisationId", "brandId", "status");
CREATE INDEX "TrackingInstallation_trackingPropertyId_idx" ON "TrackingInstallation"("trackingPropertyId");

CREATE UNIQUE INDEX "TrackingIngestLog_idempotencyKey_key" ON "TrackingIngestLog"("idempotencyKey");
CREATE INDEX "TrackingIngestLog_organisationId_brandId_receivedAt_idx" ON "TrackingIngestLog"("organisationId", "brandId", "receivedAt");
CREATE INDEX "TrackingIngestLog_trackingPropertyId_status_idx" ON "TrackingIngestLog"("trackingPropertyId", "status");
CREATE INDEX "TrackingIngestLog_eventName_idx" ON "TrackingIngestLog"("eventName");

-- Foreign keys
ALTER TABLE "TrackingProperty" ADD CONSTRAINT "TrackingProperty_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingProperty" ADD CONSTRAINT "TrackingProperty_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingProperty" ADD CONSTRAINT "TrackingProperty_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrackingDomain" ADD CONSTRAINT "TrackingDomain_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingDomain" ADD CONSTRAINT "TrackingDomain_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingDomain" ADD CONSTRAINT "TrackingDomain_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingDomain" ADD CONSTRAINT "TrackingDomain_trackingPropertyId_fkey" FOREIGN KEY ("trackingPropertyId") REFERENCES "TrackingProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingDomain" ADD CONSTRAINT "TrackingDomain_trackingEnvironmentId_fkey" FOREIGN KEY ("trackingEnvironmentId") REFERENCES "TrackingEnvironment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TrackingEnvironment" ADD CONSTRAINT "TrackingEnvironment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingEnvironment" ADD CONSTRAINT "TrackingEnvironment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingEnvironment" ADD CONSTRAINT "TrackingEnvironment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingEnvironment" ADD CONSTRAINT "TrackingEnvironment_trackingPropertyId_fkey" FOREIGN KEY ("trackingPropertyId") REFERENCES "TrackingProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrackingApiKey" ADD CONSTRAINT "TrackingApiKey_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingApiKey" ADD CONSTRAINT "TrackingApiKey_trackingPropertyId_fkey" FOREIGN KEY ("trackingPropertyId") REFERENCES "TrackingProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrackingInstallation" ADD CONSTRAINT "TrackingInstallation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingInstallation" ADD CONSTRAINT "TrackingInstallation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingInstallation" ADD CONSTRAINT "TrackingInstallation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingInstallation" ADD CONSTRAINT "TrackingInstallation_trackingPropertyId_fkey" FOREIGN KEY ("trackingPropertyId") REFERENCES "TrackingProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingInstallation" ADD CONSTRAINT "TrackingInstallation_trackingEnvironmentId_fkey" FOREIGN KEY ("trackingEnvironmentId") REFERENCES "TrackingEnvironment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TrackingIngestLog" ADD CONSTRAINT "TrackingIngestLog_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingIngestLog" ADD CONSTRAINT "TrackingIngestLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingIngestLog" ADD CONSTRAINT "TrackingIngestLog_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackingIngestLog" ADD CONSTRAINT "TrackingIngestLog_trackingPropertyId_fkey" FOREIGN KEY ("trackingPropertyId") REFERENCES "TrackingProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
