-- Stage 17: Security, reliability and enterprise administration

CREATE TYPE "SupportAccessStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
CREATE TYPE "DataDeletionRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');
CREATE TYPE "IncidentSeverity" AS ENUM ('SEV1', 'SEV2', 'SEV3', 'SEV4');
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'MITIGATING', 'RESOLVED', 'CLOSED');

CREATE TABLE "PlatformAdminGrant" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "grantedById" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformAdminGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformFeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformFeatureFlag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportAccessSession" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetOrgId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "SupportAccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportAccessSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataRetentionPolicy" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "anonymiseAfter" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DataRetentionPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataDeletionRequest" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "subjectEmail" TEXT,
    "status" "DataDeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DataDeletionRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncidentLog" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'SEV3',
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "openedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IncidentLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAdminGrant_userProfileId_key" ON "PlatformAdminGrant"("userProfileId");
CREATE INDEX "PlatformAdminGrant_createdAt_idx" ON "PlatformAdminGrant"("createdAt");
CREATE INDEX "SystemAnnouncement_isActive_startsAt_endsAt_idx" ON "SystemAnnouncement"("isActive", "startsAt", "endsAt");
CREATE UNIQUE INDEX "PlatformFeatureFlag_key_key" ON "PlatformFeatureFlag"("key");
CREATE INDEX "PlatformFeatureFlag_enabled_idx" ON "PlatformFeatureFlag"("enabled");
CREATE INDEX "SupportAccessSession_status_expiresAt_idx" ON "SupportAccessSession"("status", "expiresAt");
CREATE INDEX "SupportAccessSession_adminUserId_idx" ON "SupportAccessSession"("adminUserId");
CREATE INDEX "SupportAccessSession_targetUserId_idx" ON "SupportAccessSession"("targetUserId");
CREATE UNIQUE INDEX "DataRetentionPolicy_resourceType_key" ON "DataRetentionPolicy"("resourceType");
CREATE INDEX "DataDeletionRequest_organisationId_status_idx" ON "DataDeletionRequest"("organisationId", "status");
CREATE INDEX "DataDeletionRequest_status_createdAt_idx" ON "DataDeletionRequest"("status", "createdAt");
CREATE INDEX "IncidentLog_status_severity_idx" ON "IncidentLog"("status", "severity");
CREATE INDEX "IncidentLog_createdAt_idx" ON "IncidentLog"("createdAt");

ALTER TABLE "PlatformAdminGrant" ADD CONSTRAINT "PlatformAdminGrant_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformAdminGrant" ADD CONSTRAINT "PlatformAdminGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SystemAnnouncement" ADD CONSTRAINT "SystemAnnouncement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportAccessSession" ADD CONSTRAINT "SupportAccessSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportAccessSession" ADD CONSTRAINT "SupportAccessSession_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportAccessSession" ADD CONSTRAINT "SupportAccessSession_targetOrgId_fkey" FOREIGN KEY ("targetOrgId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportAccessSession" ADD CONSTRAINT "SupportAccessSession_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataDeletionRequest" ADD CONSTRAINT "DataDeletionRequest_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataDeletionRequest" ADD CONSTRAINT "DataDeletionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentLog" ADD CONSTRAINT "IncidentLog_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
