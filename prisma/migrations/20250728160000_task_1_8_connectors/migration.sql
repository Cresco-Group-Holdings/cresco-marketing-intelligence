-- CreateEnum
CREATE TYPE "ConnectorType" AS ENUM ('GOOGLE_ANALYTICS_4', 'GOOGLE_SEARCH_CONSOLE', 'GOOGLE_ADS', 'META', 'INSTAGRAM', 'LINKEDIN', 'TIKTOK', 'YOUTUBE', 'X', 'STRIPE', 'EMAIL_PROVIDER', 'CRM_PROVIDER');

-- CreateEnum
CREATE TYPE "ConnectorPlatformAvailability" AS ENUM ('COMING_SOON', 'AVAILABLE');

-- CreateEnum
CREATE TYPE "ConnectorStatus" AS ENUM ('NOT_CONFIGURED', 'AVAILABLE', 'CONNECTING', 'CONNECTED', 'ERROR', 'REAUTH_REQUIRED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ConnectorSyncType" AS ENUM ('INITIAL', 'INCREMENTAL');

-- CreateEnum
CREATE TYPE "ConnectorSyncStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConnectorErrorCategory" AS ENUM ('AUTHENTICATION', 'AUTHORIZATION', 'RATE_LIMIT', 'NETWORK', 'VALIDATION', 'PROVIDER', 'INTERNAL');

-- CreateEnum
CREATE TYPE "WebhookEndpointStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'DUPLICATE');

-- CreateTable
CREATE TABLE "ConnectorDefinition" (
    "id" TEXT NOT NULL,
    "key" "ConnectorType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "requiredScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "optionalScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "supportsOAuth" BOOLEAN NOT NULL DEFAULT true,
    "platformAvailability" "ConnectorPlatformAvailability" NOT NULL DEFAULT 'COMING_SOON',
    "documentationUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectorDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorAccount" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "connectorDefinitionId" TEXT NOT NULL,
    "connectorType" "ConnectorType" NOT NULL,
    "status" "ConnectorStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "displayName" TEXT,
    "externalAccountId" TEXT,
    "externalAccountLabel" TEXT,
    "grantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "connectedByUserId" TEXT,
    "connectedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "lastSyncAttemptAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectorAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorCredential" (
    "id" TEXT NOT NULL,
    "connectorAccountId" TEXT NOT NULL,
    "encryptionKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectorCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorSync" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "connectorAccountId" TEXT NOT NULL,
    "syncType" "ConnectorSyncType" NOT NULL,
    "status" "ConnectorSyncStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "partialFailure" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectorSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorSyncCursor" (
    "id" TEXT NOT NULL,
    "connectorAccountId" TEXT NOT NULL,
    "connectorSyncId" TEXT,
    "cursorKey" TEXT NOT NULL,
    "cursorValue" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectorSyncCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorError" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "connectorAccountId" TEXT NOT NULL,
    "connectorSyncId" TEXT,
    "category" "ConnectorErrorCategory" NOT NULL,
    "message" TEXT NOT NULL,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectorError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "connectorAccountId" TEXT,
    "path" TEXT NOT NULL,
    "secretDigest" TEXT NOT NULL,
    "status" "WebhookEndpointStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "webhookEndpointId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadDigest" TEXT NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorOAuthState" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "connectorType" "ConnectorType" NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "redirectUri" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectorOAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorDefinition_key_key" ON "ConnectorDefinition"("key");

-- CreateIndex
CREATE INDEX "ConnectorDefinition_platformAvailability_idx" ON "ConnectorDefinition"("platformAvailability");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorAccount_brandId_connectorType_key" ON "ConnectorAccount"("brandId", "connectorType");

-- CreateIndex
CREATE INDEX "ConnectorAccount_organisationId_idx" ON "ConnectorAccount"("organisationId");

-- CreateIndex
CREATE INDEX "ConnectorAccount_projectId_idx" ON "ConnectorAccount"("projectId");

-- CreateIndex
CREATE INDEX "ConnectorAccount_brandId_idx" ON "ConnectorAccount"("brandId");

-- CreateIndex
CREATE INDEX "ConnectorAccount_status_idx" ON "ConnectorAccount"("status");

-- CreateIndex
CREATE INDEX "ConnectorAccount_connectorType_idx" ON "ConnectorAccount"("connectorType");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorCredential_connectorAccountId_key" ON "ConnectorCredential"("connectorAccountId");

-- CreateIndex
CREATE INDEX "ConnectorCredential_tokenExpiresAt_idx" ON "ConnectorCredential"("tokenExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorSync_connectorAccountId_idempotencyKey_key" ON "ConnectorSync"("connectorAccountId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ConnectorSync_organisationId_idx" ON "ConnectorSync"("organisationId");

-- CreateIndex
CREATE INDEX "ConnectorSync_projectId_idx" ON "ConnectorSync"("projectId");

-- CreateIndex
CREATE INDEX "ConnectorSync_brandId_idx" ON "ConnectorSync"("brandId");

-- CreateIndex
CREATE INDEX "ConnectorSync_status_idx" ON "ConnectorSync"("status");

-- CreateIndex
CREATE INDEX "ConnectorSync_createdAt_idx" ON "ConnectorSync"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorSyncCursor_connectorAccountId_cursorKey_key" ON "ConnectorSyncCursor"("connectorAccountId", "cursorKey");

-- CreateIndex
CREATE INDEX "ConnectorSyncCursor_connectorSyncId_idx" ON "ConnectorSyncCursor"("connectorSyncId");

-- CreateIndex
CREATE INDEX "ConnectorError_organisationId_idx" ON "ConnectorError"("organisationId");

-- CreateIndex
CREATE INDEX "ConnectorError_connectorAccountId_idx" ON "ConnectorError"("connectorAccountId");

-- CreateIndex
CREATE INDEX "ConnectorError_occurredAt_idx" ON "ConnectorError"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEndpoint_brandId_path_key" ON "WebhookEndpoint"("brandId", "path");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_organisationId_idx" ON "WebhookEndpoint"("organisationId");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_status_idx" ON "WebhookEndpoint"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_webhookEndpointId_idempotencyKey_key" ON "WebhookEvent"("webhookEndpointId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_idx" ON "WebhookEvent"("status");

-- CreateIndex
CREATE INDEX "WebhookEvent_receivedAt_idx" ON "WebhookEvent"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorOAuthState_state_key" ON "ConnectorOAuthState"("state");

-- CreateIndex
CREATE INDEX "ConnectorOAuthState_organisationId_idx" ON "ConnectorOAuthState"("organisationId");

-- CreateIndex
CREATE INDEX "ConnectorOAuthState_brandId_idx" ON "ConnectorOAuthState"("brandId");

-- CreateIndex
CREATE INDEX "ConnectorOAuthState_expiresAt_idx" ON "ConnectorOAuthState"("expiresAt");

-- AddForeignKey
ALTER TABLE "ConnectorAccount" ADD CONSTRAINT "ConnectorAccount_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorAccount" ADD CONSTRAINT "ConnectorAccount_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorAccount" ADD CONSTRAINT "ConnectorAccount_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorAccount" ADD CONSTRAINT "ConnectorAccount_connectorDefinitionId_fkey" FOREIGN KEY ("connectorDefinitionId") REFERENCES "ConnectorDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorAccount" ADD CONSTRAINT "ConnectorAccount_connectedByUserId_fkey" FOREIGN KEY ("connectedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorCredential" ADD CONSTRAINT "ConnectorCredential_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "ConnectorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorSync" ADD CONSTRAINT "ConnectorSync_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorSync" ADD CONSTRAINT "ConnectorSync_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorSync" ADD CONSTRAINT "ConnectorSync_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorSync" ADD CONSTRAINT "ConnectorSync_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "ConnectorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorSyncCursor" ADD CONSTRAINT "ConnectorSyncCursor_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "ConnectorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorSyncCursor" ADD CONSTRAINT "ConnectorSyncCursor_connectorSyncId_fkey" FOREIGN KEY ("connectorSyncId") REFERENCES "ConnectorSync"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorError" ADD CONSTRAINT "ConnectorError_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorError" ADD CONSTRAINT "ConnectorError_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorError" ADD CONSTRAINT "ConnectorError_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorError" ADD CONSTRAINT "ConnectorError_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "ConnectorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorError" ADD CONSTRAINT "ConnectorError_connectorSyncId_fkey" FOREIGN KEY ("connectorSyncId") REFERENCES "ConnectorSync"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "ConnectorAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_webhookEndpointId_fkey" FOREIGN KEY ("webhookEndpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorOAuthState" ADD CONSTRAINT "ConnectorOAuthState_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorOAuthState" ADD CONSTRAINT "ConnectorOAuthState_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorOAuthState" ADD CONSTRAINT "ConnectorOAuthState_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed connector definitions
INSERT INTO "ConnectorDefinition" ("id", "key", "name", "description", "category", "requiredScopes", "optionalScopes", "supportsOAuth", "platformAvailability", "documentationUrl", "updatedAt")
VALUES
  ('conn_def_ga4', 'GOOGLE_ANALYTICS_4', 'Google Analytics 4', 'Import website analytics, events, and conversion data from GA4.', 'Analytics', ARRAY['https://www.googleapis.com/auth/analytics.readonly'], ARRAY[]::TEXT[], true, 'COMING_SOON', 'https://developers.google.com/analytics', CURRENT_TIMESTAMP),
  ('conn_def_gsc', 'GOOGLE_SEARCH_CONSOLE', 'Google Search Console', 'Import search performance, indexing, and query data.', 'SEO', ARRAY['https://www.googleapis.com/auth/webmasters.readonly'], ARRAY[]::TEXT[], true, 'COMING_SOON', 'https://developers.google.com/webmaster-tools', CURRENT_TIMESTAMP),
  ('conn_def_gads', 'GOOGLE_ADS', 'Google Ads', 'Import campaign, ad group, and spend data from Google Ads.', 'Advertising', ARRAY['https://www.googleapis.com/auth/adwords'], ARRAY[]::TEXT[], true, 'COMING_SOON', 'https://developers.google.com/google-ads/api', CURRENT_TIMESTAMP),
  ('conn_def_meta', 'META', 'Meta', 'Import advertising and page insights from Meta platforms.', 'Advertising', ARRAY['ads_read'], ARRAY['pages_read_engagement'], true, 'COMING_SOON', 'https://developers.facebook.com/docs/marketing-apis', CURRENT_TIMESTAMP),
  ('conn_def_instagram', 'INSTAGRAM', 'Instagram', 'Import Instagram business account content and insights.', 'Social', ARRAY['instagram_basic'], ARRAY['instagram_manage_insights'], true, 'COMING_SOON', 'https://developers.facebook.com/docs/instagram-api', CURRENT_TIMESTAMP),
  ('conn_def_linkedin', 'LINKEDIN', 'LinkedIn', 'Import LinkedIn page and advertising performance data.', 'Social', ARRAY['r_organization_social'], ARRAY['r_ads'], true, 'COMING_SOON', 'https://learn.microsoft.com/en-us/linkedin/', CURRENT_TIMESTAMP),
  ('conn_def_tiktok', 'TIKTOK', 'TikTok', 'Import TikTok advertising and organic performance data.', 'Social', ARRAY['user.info.basic'], ARRAY['video.list'], true, 'COMING_SOON', 'https://developers.tiktok.com/', CURRENT_TIMESTAMP),
  ('conn_def_youtube', 'YOUTUBE', 'YouTube', 'Import YouTube channel analytics and content metadata.', 'Social', ARRAY['https://www.googleapis.com/auth/youtube.readonly'], ARRAY['https://www.googleapis.com/auth/yt-analytics.readonly'], true, 'COMING_SOON', 'https://developers.google.com/youtube', CURRENT_TIMESTAMP),
  ('conn_def_x', 'X', 'X', 'Import X account analytics and post performance.', 'Social', ARRAY['tweet.read'], ARRAY['users.read'], true, 'COMING_SOON', 'https://developer.x.com/en/docs', CURRENT_TIMESTAMP),
  ('conn_def_stripe', 'STRIPE', 'Stripe', 'Import revenue, subscription, and payment events.', 'Commerce', ARRAY['read_only'], ARRAY[]::TEXT[], true, 'COMING_SOON', 'https://stripe.com/docs/api', CURRENT_TIMESTAMP),
  ('conn_def_email', 'EMAIL_PROVIDER', 'Email Provider', 'Connect email marketing platforms for campaign and list data.', 'Email', ARRAY['campaigns.read'], ARRAY['lists.read'], true, 'COMING_SOON', NULL, CURRENT_TIMESTAMP),
  ('conn_def_crm', 'CRM_PROVIDER', 'CRM Provider', 'Connect CRM systems for lead and pipeline data.', 'CRM', ARRAY['contacts.read'], ARRAY['deals.read'], true, 'COMING_SOON', NULL, CURRENT_TIMESTAMP);
