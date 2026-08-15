-- Stage 12: OAuth, credentials and connection management

ALTER TYPE "ProviderConnectionStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "ProviderConnectionStatus" ADD VALUE IF NOT EXISTS 'ACTION_REQUIRED';
ALTER TYPE "ProviderConnectionStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "ProviderConnectionStatus" ADD VALUE IF NOT EXISTS 'RECONNECTED';
ALTER TYPE "ProviderConnectionStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

ALTER TYPE "ProviderAuditAction" ADD VALUE IF NOT EXISTS 'CREDENTIAL_STORED';
ALTER TYPE "ProviderAuditAction" ADD VALUE IF NOT EXISTS 'CREDENTIAL_ACCESSED';
ALTER TYPE "ProviderAuditAction" ADD VALUE IF NOT EXISTS 'CONNECTION_STATUS_CHANGED';
ALTER TYPE "ProviderAuditAction" ADD VALUE IF NOT EXISTS 'CREDENTIAL_ROTATED';

ALTER TABLE "ProviderCredential"
  ADD COLUMN IF NOT EXISTS "revokedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "rotatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rotationVersion" INTEGER NOT NULL DEFAULT 1;

DO $$ BEGIN
  ALTER TABLE "ProviderCredential"
    ADD CONSTRAINT "ProviderCredential_revokedByUserId_fkey"
    FOREIGN KEY ("revokedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TYPE "ProviderConnectionAccountStatus" AS ENUM ('DISCOVERED', 'SELECTED', 'DISABLED', 'ARCHIVED');

CREATE TABLE "OAuthTransaction" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "connectionId" TEXT,
  "initiatedByUserId" TEXT NOT NULL,
  "encryptedState" TEXT NOT NULL,
  "stateDigest" TEXT NOT NULL,
  "codeVerifierReference" TEXT,
  "requestedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "returnPath" TEXT,
  "redirectUri" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthTransaction_stateDigest_key" ON "OAuthTransaction"("stateDigest");
CREATE INDEX "OAuthTransaction_organisationId_providerKey_createdAt_idx" ON "OAuthTransaction"("organisationId", "providerKey", "createdAt");
CREATE INDEX "OAuthTransaction_expiresAt_idx" ON "OAuthTransaction"("expiresAt");
CREATE INDEX "OAuthTransaction_connectionId_idx" ON "OAuthTransaction"("connectionId");

ALTER TABLE "OAuthTransaction"
  ADD CONSTRAINT "OAuthTransaction_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthTransaction"
  ADD CONSTRAINT "OAuthTransaction_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "ProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthTransaction"
  ADD CONSTRAINT "OAuthTransaction_initiatedByUserId_fkey"
  FOREIGN KEY ("initiatedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProviderConnectionAccount" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "externalAccountId" TEXT NOT NULL,
  "accountType" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "status" "ProviderConnectionAccountStatus" NOT NULL DEFAULT 'DISCOVERED',
  "metadata" JSONB,
  "selectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderConnectionAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderConnectionAccount_connectionId_externalAccountId_accountType_key"
  ON "ProviderConnectionAccount"("connectionId", "externalAccountId", "accountType");
CREATE INDEX "ProviderConnectionAccount_organisationId_providerKey_idx"
  ON "ProviderConnectionAccount"("organisationId", "providerKey");
CREATE INDEX "ProviderConnectionAccount_connectionId_status_idx"
  ON "ProviderConnectionAccount"("connectionId", "status");

ALTER TABLE "ProviderConnectionAccount"
  ADD CONSTRAINT "ProviderConnectionAccount_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "ProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProviderConnectionScopeRecord" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "requestedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "grantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "missingScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "optionalScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "capabilityMap" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderConnectionScopeRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderConnectionScopeRecord_connectionId_key"
  ON "ProviderConnectionScopeRecord"("connectionId");
CREATE INDEX "ProviderConnectionScopeRecord_organisationId_idx"
  ON "ProviderConnectionScopeRecord"("organisationId");

ALTER TABLE "ProviderConnectionScopeRecord"
  ADD CONSTRAINT "ProviderConnectionScopeRecord_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "ProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
