-- CreateEnum
CREATE TYPE "OrganisationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'REMOVED');
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "BrandStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- UserProfile expansion
ALTER TABLE "UserProfile" RENAME COLUMN "userId" TO "authUserId";
ALTER TABLE "UserProfile" ADD COLUMN "displayName" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "firstName" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "lastName" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "timezone" TEXT DEFAULT 'UTC';
ALTER TABLE "UserProfile" ADD COLUMN "locale" TEXT DEFAULT 'en-GB';
UPDATE "UserProfile" SET "displayName" = "fullName" WHERE "fullName" IS NOT NULL;
ALTER TABLE "UserProfile" DROP COLUMN "fullName";

-- Organisation expansion
ALTER TABLE "Organisation" ADD COLUMN "legalName" TEXT;
ALTER TABLE "Organisation" ADD COLUMN "website" TEXT;
ALTER TABLE "Organisation" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "Organisation" ADD COLUMN "industry" TEXT;
ALTER TABLE "Organisation" ADD COLUMN "countryCode" TEXT;
ALTER TABLE "Organisation" ADD COLUMN "defaultTimezone" TEXT DEFAULT 'UTC';
ALTER TABLE "Organisation" ADD COLUMN "status" "OrganisationStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Organisation" ADD COLUMN "createdByUserId" TEXT;

UPDATE "Organisation" o
SET "createdByUserId" = (
  SELECT om."userProfileId"
  FROM "OrganisationMembership" om
  WHERE om."organisationId" = o."id" AND om."role" = 'OWNER'
  ORDER BY om."createdAt" ASC
  LIMIT 1
)
WHERE "createdByUserId" IS NULL;

UPDATE "Organisation" o
SET "createdByUserId" = (
  SELECT om."userProfileId"
  FROM "OrganisationMembership" om
  WHERE om."organisationId" = o."id"
  ORDER BY om."createdAt" ASC
  LIMIT 1
)
WHERE "createdByUserId" IS NULL;

ALTER TABLE "Organisation" ALTER COLUMN "createdByUserId" SET NOT NULL;
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Organisation_status_idx" ON "Organisation"("status");
CREATE INDEX "Organisation_archivedAt_idx" ON "Organisation"("archivedAt");
CREATE INDEX "Organisation_createdAt_idx" ON "Organisation"("createdAt");

-- OrganisationMembership expansion
ALTER TABLE "OrganisationMembership" RENAME COLUMN "userProfileId" TO "userId";
ALTER TABLE "OrganisationMembership" ADD COLUMN "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "OrganisationMembership" ADD COLUMN "joinedAt" TIMESTAMP(3);
UPDATE "OrganisationMembership" SET "joinedAt" = "createdAt" WHERE "joinedAt" IS NULL;
CREATE INDEX "OrganisationMembership_status_idx" ON "OrganisationMembership"("status");

-- Project expansion
ALTER TABLE "Project" ADD COLUMN "website" TEXT;
ALTER TABLE "Project" ADD COLUMN "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Project" ADD COLUMN "createdByUserId" TEXT;

UPDATE "Project" p
SET "createdByUserId" = (
  SELECT o."createdByUserId" FROM "Organisation" o WHERE o."id" = p."organisationId"
)
WHERE "createdByUserId" IS NULL;

ALTER TABLE "Project" ALTER COLUMN "createdByUserId" SET NOT NULL;
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Project_status_idx" ON "Project"("status");
CREATE INDEX "Project_archivedAt_idx" ON "Project"("archivedAt");

-- Brand expansion
ALTER TABLE "Brand" ADD COLUMN "website" TEXT;
ALTER TABLE "Brand" ADD COLUMN "primaryDomain" TEXT;
ALTER TABLE "Brand" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "Brand" ADD COLUMN "faviconUrl" TEXT;
ALTER TABLE "Brand" ADD COLUMN "primaryColour" TEXT;
ALTER TABLE "Brand" ADD COLUMN "secondaryColour" TEXT;
ALTER TABLE "Brand" ADD COLUMN "accentColour" TEXT;
ALTER TABLE "Brand" ADD COLUMN "status" "BrandStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Brand" ADD COLUMN "createdByUserId" TEXT;

UPDATE "Brand" b
SET "createdByUserId" = (
  SELECT p."createdByUserId" FROM "Project" p WHERE p."id" = b."projectId"
)
WHERE "createdByUserId" IS NULL;

ALTER TABLE "Brand" ALTER COLUMN "createdByUserId" SET NOT NULL;
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Brand_status_idx" ON "Brand"("status");
CREATE INDEX "Brand_archivedAt_idx" ON "Brand"("archivedAt");

-- BrandProfile
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "shortDescription" TEXT,
    "longDescription" TEXT,
    "mission" TEXT,
    "valueProposition" TEXT,
    "targetAudience" TEXT,
    "customerProblems" TEXT,
    "keyBenefits" TEXT,
    "productsAndServices" TEXT,
    "preferredTone" TEXT,
    "prohibitedTone" TEXT,
    "preferredLanguage" TEXT,
    "targetCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetIndustries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "competitors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "complianceNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BrandProfile_brandId_key" ON "BrandProfile"("brandId");
CREATE INDEX "BrandProfile_organisationId_idx" ON "BrandProfile"("organisationId");
CREATE INDEX "BrandProfile_projectId_idx" ON "BrandProfile"("projectId");
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- WorkspacePreference
CREATE TABLE "WorkspacePreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentOrganisationId" TEXT,
    "currentProjectId" TEXT,
    "currentBrandId" TEXT,
    "onboardingCompletedAt" TIMESTAMP(3),
    "onboardingStep" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspacePreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspacePreference_userId_key" ON "WorkspacePreference"("userId");
CREATE INDEX "WorkspacePreference_currentOrganisationId_idx" ON "WorkspacePreference"("currentOrganisationId");
CREATE INDEX "WorkspacePreference_currentProjectId_idx" ON "WorkspacePreference"("currentProjectId");
CREATE INDEX "WorkspacePreference_currentBrandId_idx" ON "WorkspacePreference"("currentBrandId");
ALTER TABLE "WorkspacePreference" ADD CONSTRAINT "WorkspacePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invitation
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrganisationRole" NOT NULL DEFAULT 'VIEWER',
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "acceptedByUserId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_organisationId_idx" ON "Invitation"("organisationId");
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");
CREATE INDEX "Invitation_status_idx" ON "Invitation"("status");
CREATE INDEX "Invitation_expiresAt_idx" ON "Invitation"("expiresAt");
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AuditLog expansion
ALTER TABLE "AuditLog" ADD COLUMN "projectId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "requestId" TEXT;
CREATE INDEX "AuditLog_projectId_idx" ON "AuditLog"("projectId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
