-- CreateEnum
CREATE TYPE "SocialProvider" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'TIKTOK', 'YOUTUBE', 'X');

-- CreateEnum
CREATE TYPE "SocialConnectionStatus" AS ENUM ('CONNECTING', 'CONNECTED', 'REAUTH_REQUIRED', 'PERMISSION_MISSING', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "SocialAccountType" AS ENUM ('INSTAGRAM_BUSINESS', 'FACEBOOK_PAGE', 'LINKEDIN_ORGANISATION', 'LINKEDIN_MEMBER', 'TIKTOK_BUSINESS', 'YOUTUBE_CHANNEL', 'X_ACCOUNT');

-- CreateEnum
CREATE TYPE "SocialCapability" AS ENUM ('PUBLISH_TEXT', 'PUBLISH_IMAGE', 'PUBLISH_CAROUSEL', 'PUBLISH_VIDEO', 'PUBLISH_SHORT_VIDEO', 'SCHEDULE_NATIVELY', 'READ_INSIGHTS', 'READ_COMMENTS', 'MANAGE_COMMENTS', 'READ_MESSAGES', 'WEBHOOK_SUPPORT');

-- CreateEnum
CREATE TYPE "CredentialRotationReason" AS ENUM ('SCHEDULED', 'KEY_ROTATION', 'MANUAL', 'COMPROMISE_RESPONSE');

-- CreateTable
CREATE TABLE "SocialConnection" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "status" "SocialConnectionStatus" NOT NULL DEFAULT 'CONNECTING',
    "grantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "connectedByUserId" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastValidatedAt" TIMESTAMP(3),
    "lastRefreshAt" TIMESTAMP(3),
    "reconnectRequiredAt" TIMESTAMP(3),
    "pendingAccounts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "disconnectedAt" TIMESTAMP(3),

    CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialConnectionCredential" (
    "id" TEXT NOT NULL,
    "socialConnectionId" TEXT NOT NULL,
    "encryptionKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialConnectionCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "socialConnectionId" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accountType" "SocialAccountType" NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "profileUrl" TEXT,
    "avatarUrl" TEXT,
    "status" "SocialConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccountCapability" (
    "id" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "capability" "SocialCapability" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialAccountCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAuthorisationState" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "socialConnectionId" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "redirectUri" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAuthorisationState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialRotationEvent" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "socialConnectionId" TEXT NOT NULL,
    "fromKeyVersion" INTEGER NOT NULL,
    "toKeyVersion" INTEGER NOT NULL,
    "reason" "CredentialRotationReason" NOT NULL,
    "rotatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialRotationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialConnection_brandId_provider_key" ON "SocialConnection"("brandId", "provider");

-- CreateIndex
CREATE INDEX "SocialConnection_organisationId_idx" ON "SocialConnection"("organisationId");

-- CreateIndex
CREATE INDEX "SocialConnection_projectId_idx" ON "SocialConnection"("projectId");

-- CreateIndex
CREATE INDEX "SocialConnection_brandId_idx" ON "SocialConnection"("brandId");

-- CreateIndex
CREATE INDEX "SocialConnection_status_idx" ON "SocialConnection"("status");

-- CreateIndex
CREATE INDEX "SocialConnection_provider_idx" ON "SocialConnection"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "SocialConnectionCredential_socialConnectionId_key" ON "SocialConnectionCredential"("socialConnectionId");

-- CreateIndex
CREATE INDEX "SocialConnectionCredential_encryptionKeyVersion_idx" ON "SocialConnectionCredential"("encryptionKeyVersion");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_socialConnectionId_providerAccountId_key" ON "SocialAccount"("socialConnectionId", "providerAccountId");

-- CreateIndex
CREATE INDEX "SocialAccount_organisationId_idx" ON "SocialAccount"("organisationId");

-- CreateIndex
CREATE INDEX "SocialAccount_projectId_idx" ON "SocialAccount"("projectId");

-- CreateIndex
CREATE INDEX "SocialAccount_brandId_idx" ON "SocialAccount"("brandId");

-- CreateIndex
CREATE INDEX "SocialAccount_provider_idx" ON "SocialAccount"("provider");

-- CreateIndex
CREATE INDEX "SocialAccount_status_idx" ON "SocialAccount"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccountCapability_socialAccountId_capability_key" ON "SocialAccountCapability"("socialAccountId", "capability");

-- CreateIndex
CREATE INDEX "SocialAccountCapability_capability_idx" ON "SocialAccountCapability"("capability");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAuthorisationState_state_key" ON "OAuthAuthorisationState"("state");

-- CreateIndex
CREATE INDEX "OAuthAuthorisationState_organisationId_idx" ON "OAuthAuthorisationState"("organisationId");

-- CreateIndex
CREATE INDEX "OAuthAuthorisationState_brandId_idx" ON "OAuthAuthorisationState"("brandId");

-- CreateIndex
CREATE INDEX "OAuthAuthorisationState_userId_idx" ON "OAuthAuthorisationState"("userId");

-- CreateIndex
CREATE INDEX "OAuthAuthorisationState_expiresAt_idx" ON "OAuthAuthorisationState"("expiresAt");

-- CreateIndex
CREATE INDEX "OAuthAuthorisationState_consumedAt_idx" ON "OAuthAuthorisationState"("consumedAt");

-- CreateIndex
CREATE INDEX "CredentialRotationEvent_socialConnectionId_idx" ON "CredentialRotationEvent"("socialConnectionId");

-- CreateIndex
CREATE INDEX "CredentialRotationEvent_createdAt_idx" ON "CredentialRotationEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_connectedByUserId_fkey" FOREIGN KEY ("connectedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialConnectionCredential" ADD CONSTRAINT "SocialConnectionCredential_socialConnectionId_fkey" FOREIGN KEY ("socialConnectionId") REFERENCES "SocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_socialConnectionId_fkey" FOREIGN KEY ("socialConnectionId") REFERENCES "SocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccountCapability" ADD CONSTRAINT "SocialAccountCapability_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorisationState" ADD CONSTRAINT "OAuthAuthorisationState_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorisationState" ADD CONSTRAINT "OAuthAuthorisationState_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorisationState" ADD CONSTRAINT "OAuthAuthorisationState_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorisationState" ADD CONSTRAINT "OAuthAuthorisationState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorisationState" ADD CONSTRAINT "OAuthAuthorisationState_socialConnectionId_fkey" FOREIGN KEY ("socialConnectionId") REFERENCES "SocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialRotationEvent" ADD CONSTRAINT "CredentialRotationEvent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialRotationEvent" ADD CONSTRAINT "CredentialRotationEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialRotationEvent" ADD CONSTRAINT "CredentialRotationEvent_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialRotationEvent" ADD CONSTRAINT "CredentialRotationEvent_socialConnectionId_fkey" FOREIGN KEY ("socialConnectionId") REFERENCES "SocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialRotationEvent" ADD CONSTRAINT "CredentialRotationEvent_rotatedByUserId_fkey" FOREIGN KEY ("rotatedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
