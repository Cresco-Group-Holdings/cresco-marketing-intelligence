-- Task 7.1: Provider Integration Foundation

CREATE TYPE "ProviderAuthType" AS ENUM (
  'OAUTH2_AUTHORIZATION_CODE',
  'OAUTH2_PKCE',
  'API_KEY',
  'BASIC_AUTH',
  'BEARER_TOKEN',
  'SERVICE_ACCOUNT',
  'SMTP_CREDENTIALS',
  'AWS_SIGNATURE',
  'WEBHOOK_ONLY',
  'INTERNAL',
  'NONE'
);

CREATE TYPE "ProviderCategory" AS ENUM (
  'SOCIAL',
  'ANALYTICS',
  'ADVERTISING',
  'EMAIL',
  'PAYMENTS',
  'SEO',
  'DATA',
  'INTERNAL'
);

CREATE TYPE "ProviderConnectionStatus" AS ENUM (
  'DRAFT',
  'PENDING_AUTHORIZATION',
  'CONNECTED',
  'DEGRADED',
  'REAUTH_REQUIRED',
  'RATE_LIMITED',
  'SUSPENDED',
  'DISABLED',
  'REVOKED',
  'ERROR'
);

CREATE TYPE "ProviderEnvironment" AS ENUM ('SANDBOX', 'STAGING', 'PRODUCTION');

CREATE TYPE "ProviderCapabilityType" AS ENUM (
  'PUBLISHING',
  'ANALYTICS_PULL',
  'ANALYTICS_PUSH',
  'ADVERTISING_MANAGE',
  'ADVERTISING_REPORT',
  'EMAIL_SEND',
  'EMAIL_WEBHOOK',
  'PAYMENT_SYNC',
  'SEARCH_RANK',
  'WEBHOOK_INGEST',
  'OAUTH_CONNECT',
  'DATA_IMPORT',
  'CRAWL'
);

CREATE TYPE "ProviderApiVersionStatus" AS ENUM ('CURRENT', 'DEPRECATED', 'SUNSET');

CREATE TYPE "ProviderWebhookEventStatus" AS ENUM (
  'RECEIVED',
  'VERIFIED',
  'PROCESSING',
  'PROCESSED',
  'REJECTED',
  'DEAD_LETTER',
  'DUPLICATE'
);

CREATE TYPE "ProviderSyncRunStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "ProviderHealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN');

CREATE TYPE "ProviderAuditAction" AS ENUM (
  'CONNECTION_CREATED',
  'AUTHORIZATION_STARTED',
  'AUTHORIZATION_COMPLETED',
  'AUTHORIZATION_FAILED',
  'CREDENTIAL_REFRESHED',
  'CREDENTIAL_REVOKED',
  'CONNECTION_TESTED',
  'CONNECTION_DEGRADED',
  'CONNECTION_RESTORED',
  'WEBHOOK_RECEIVED',
  'WEBHOOK_REJECTED',
  'SYNC_STARTED',
  'SYNC_COMPLETED',
  'SYNC_FAILED',
  'RATE_LIMIT_REACHED',
  'PROVIDER_DISABLED',
  'CONFIGURATION_CHANGED'
);

CREATE TYPE "ProviderCredentialType" AS ENUM (
  'OAUTH_ACCESS_TOKEN',
  'OAUTH_REFRESH_TOKEN',
  'API_KEY',
  'CLIENT_SECRET',
  'WEBHOOK_SIGNING_SECRET',
  'SMTP_PASSWORD',
  'SERVICE_ACCOUNT_KEY',
  'BEARER_TOKEN',
  'BASIC_AUTH'
);

CREATE TYPE "ProviderCircuitState" AS ENUM ('CLOSED', 'OPEN', 'HALF_OPEN');

CREATE TABLE "ProviderConnection" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT,
  "brandId" TEXT,
  "userId" TEXT,
  "providerKey" TEXT NOT NULL,
  "providerVersion" TEXT NOT NULL DEFAULT '1.0',
  "displayName" TEXT,
  "category" "ProviderCategory" NOT NULL,
  "authType" "ProviderAuthType" NOT NULL,
  "environment" "ProviderEnvironment" NOT NULL DEFAULT 'PRODUCTION',
  "status" "ProviderConnectionStatus" NOT NULL DEFAULT 'DRAFT',
  "configuration" JSONB,
  "grantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "externalAccountId" TEXT,
  "externalLabel" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "lastHealthCheckAt" TIMESTAMP(3),
  "lastSuccessfulAt" TIMESTAMP(3),
  "lastErrorAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "createdByUserId" TEXT,
  "connectedAt" TIMESTAMP(3),
  "disconnectedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderCredential" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "credentialType" "ProviderCredentialType" NOT NULL,
  "encryptedValue" TEXT NOT NULL,
  "keyVersion" INTEGER NOT NULL DEFAULT 1,
  "fingerprint" TEXT,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderOAuthState" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "connectionId" TEXT,
  "providerKey" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "codeVerifier" TEXT,
  "nonce" TEXT,
  "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "redirectUri" TEXT NOT NULL,
  "returnUrl" TEXT,
  "signedPayload" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderWebhookEndpoint" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "externalId" TEXT,
  "url" TEXT NOT NULL,
  "secretDigest" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastReceivedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderWebhookEndpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderWebhookEvent" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "connectionId" TEXT,
  "endpointId" TEXT,
  "providerKey" TEXT NOT NULL,
  "externalEventId" TEXT,
  "eventType" TEXT,
  "status" "ProviderWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "payloadDigest" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  CONSTRAINT "ProviderWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderSyncCursor" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "cursorValue" TEXT NOT NULL,
  "metadata" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderSyncCursor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderSyncRun" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "resourceType" TEXT,
  "status" "ProviderSyncRunStatus" NOT NULL DEFAULT 'PENDING',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "correlationId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderRateLimitState" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "windowKey" TEXT NOT NULL,
  "requestCount" INTEGER NOT NULL DEFAULT 0,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "windowEnd" TIMESTAMP(3) NOT NULL,
  "limitReachedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderRateLimitState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderHealthState" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "status" "ProviderHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
  "lastCheckedAt" TIMESTAMP(3),
  "lastHealthyAt" TIMESTAMP(3),
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "circuitState" "ProviderCircuitState" NOT NULL DEFAULT 'CLOSED',
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "metadata" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderHealthState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderAuditEvent" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "connectionId" TEXT,
  "providerKey" TEXT NOT NULL,
  "action" "ProviderAuditAction" NOT NULL,
  "actorUserId" TEXT,
  "requestId" TEXT,
  "result" TEXT NOT NULL,
  "errorCode" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderFeatureFlag" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "flagKey" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderFeatureFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderCredential_connectionId_credentialType_key" ON "ProviderCredential"("connectionId", "credentialType");
CREATE UNIQUE INDEX "ProviderOAuthState_state_key" ON "ProviderOAuthState"("state");
CREATE UNIQUE INDEX "ProviderWebhookEvent_providerKey_externalEventId_key" ON "ProviderWebhookEvent"("providerKey", "externalEventId");
CREATE UNIQUE INDEX "ProviderSyncCursor_connectionId_resourceType_key" ON "ProviderSyncCursor"("connectionId", "resourceType");
CREATE UNIQUE INDEX "ProviderRateLimitState_connectionId_windowKey_key" ON "ProviderRateLimitState"("connectionId", "windowKey");
CREATE UNIQUE INDEX "ProviderHealthState_connectionId_key" ON "ProviderHealthState"("connectionId");
CREATE UNIQUE INDEX "ProviderFeatureFlag_organisationId_providerKey_flagKey_key" ON "ProviderFeatureFlag"("organisationId", "providerKey", "flagKey");

CREATE INDEX "ProviderConnection_organisationId_providerKey_idx" ON "ProviderConnection"("organisationId", "providerKey");
CREATE INDEX "ProviderConnection_organisationId_status_idx" ON "ProviderConnection"("organisationId", "status");
CREATE INDEX "ProviderConnection_brandId_providerKey_idx" ON "ProviderConnection"("brandId", "providerKey");
CREATE INDEX "ProviderConnection_projectId_idx" ON "ProviderConnection"("projectId");
CREATE INDEX "ProviderConnection_providerKey_status_idx" ON "ProviderConnection"("providerKey", "status");
CREATE INDEX "ProviderCredential_organisationId_idx" ON "ProviderCredential"("organisationId");
CREATE INDEX "ProviderOAuthState_organisationId_providerKey_idx" ON "ProviderOAuthState"("organisationId", "providerKey");
CREATE INDEX "ProviderOAuthState_expiresAt_idx" ON "ProviderOAuthState"("expiresAt");
CREATE INDEX "ProviderWebhookEndpoint_connectionId_idx" ON "ProviderWebhookEndpoint"("connectionId");
CREATE INDEX "ProviderWebhookEndpoint_organisationId_providerKey_idx" ON "ProviderWebhookEndpoint"("organisationId", "providerKey");
CREATE INDEX "ProviderWebhookEvent_organisationId_status_idx" ON "ProviderWebhookEvent"("organisationId", "status");
CREATE INDEX "ProviderWebhookEvent_connectionId_receivedAt_idx" ON "ProviderWebhookEvent"("connectionId", "receivedAt");
CREATE INDEX "ProviderSyncCursor_organisationId_idx" ON "ProviderSyncCursor"("organisationId");
CREATE INDEX "ProviderSyncRun_connectionId_status_idx" ON "ProviderSyncRun"("connectionId", "status");
CREATE INDEX "ProviderSyncRun_organisationId_createdAt_idx" ON "ProviderSyncRun"("organisationId", "createdAt");
CREATE INDEX "ProviderRateLimitState_organisationId_idx" ON "ProviderRateLimitState"("organisationId");
CREATE INDEX "ProviderHealthState_organisationId_status_idx" ON "ProviderHealthState"("organisationId", "status");
CREATE INDEX "ProviderAuditEvent_organisationId_createdAt_idx" ON "ProviderAuditEvent"("organisationId", "createdAt");
CREATE INDEX "ProviderAuditEvent_connectionId_action_idx" ON "ProviderAuditEvent"("connectionId", "action");
CREATE INDEX "ProviderAuditEvent_providerKey_action_idx" ON "ProviderAuditEvent"("providerKey", "action");
CREATE INDEX "ProviderFeatureFlag_organisationId_providerKey_idx" ON "ProviderFeatureFlag"("organisationId", "providerKey");

ALTER TABLE "ProviderConnection" ADD CONSTRAINT "ProviderConnection_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderConnection" ADD CONSTRAINT "ProviderConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderConnection" ADD CONSTRAINT "ProviderConnection_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderConnection" ADD CONSTRAINT "ProviderConnection_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderCredential" ADD CONSTRAINT "ProviderCredential_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderOAuthState" ADD CONSTRAINT "ProviderOAuthState_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderWebhookEndpoint" ADD CONSTRAINT "ProviderWebhookEndpoint_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderWebhookEvent" ADD CONSTRAINT "ProviderWebhookEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderWebhookEvent" ADD CONSTRAINT "ProviderWebhookEvent_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "ProviderWebhookEndpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderSyncCursor" ADD CONSTRAINT "ProviderSyncCursor_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderSyncRun" ADD CONSTRAINT "ProviderSyncRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderRateLimitState" ADD CONSTRAINT "ProviderRateLimitState_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderHealthState" ADD CONSTRAINT "ProviderHealthState_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderAuditEvent" ADD CONSTRAINT "ProviderAuditEvent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderAuditEvent" ADD CONSTRAINT "ProviderAuditEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderAuditEvent" ADD CONSTRAINT "ProviderAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderFeatureFlag" ADD CONSTRAINT "ProviderFeatureFlag_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
