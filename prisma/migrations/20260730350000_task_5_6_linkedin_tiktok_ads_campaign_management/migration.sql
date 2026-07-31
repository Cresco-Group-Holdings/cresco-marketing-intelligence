-- Task 5.6: Controlled LinkedIn & TikTok Ads Campaign Management

-- CreateEnum
CREATE TYPE "AdvertisingLinkedInAdsAccountStatus" AS ENUM ('PENDING', 'CONNECTED', 'DISCONNECTED', 'PERMISSION_LOST', 'APPROVAL_UNAVAILABLE');

-- CreateEnum
CREATE TYPE "AdvertisingLinkedInAdsDraftStatus" AS ENUM ('DRAFT', 'VALIDATED', 'STALE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdvertisingLinkedInAdsLaunchStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'LAUNCHING', 'LAUNCHED', 'PARTIAL_SUCCESS', 'FAILED', 'STALE_APPROVAL', 'POLICY_REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdvertisingLinkedInAdsOperationType" AS ENUM ('PAUSE_CAMPAIGN', 'RESUME_CAMPAIGN', 'ADJUST_BUDGET', 'UPDATE_SCHEDULE', 'REPLACE_CREATIVE', 'ARCHIVE_MAPPING');

-- CreateEnum
CREATE TYPE "AdvertisingLinkedInAdsOperationStatus" AS ENUM ('PENDING', 'PREVIEWED', 'CONFIRMED', 'EXECUTING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AdvertisingTikTokAdsAccountStatus" AS ENUM ('PENDING', 'CONNECTED', 'DISCONNECTED', 'PERMISSION_LOST', 'APPROVAL_UNAVAILABLE');

-- CreateEnum
CREATE TYPE "AdvertisingTikTokAdsDraftStatus" AS ENUM ('DRAFT', 'VALIDATED', 'STALE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdvertisingTikTokAdsLaunchStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'LAUNCHING', 'LAUNCHED', 'PARTIAL_SUCCESS', 'FAILED', 'STALE_APPROVAL', 'POLICY_REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdvertisingTikTokAdsOperationType" AS ENUM ('PAUSE_CAMPAIGN', 'RESUME_CAMPAIGN', 'PAUSE_AD_GROUP', 'RESUME_AD_GROUP', 'ADJUST_BUDGET', 'UPDATE_SCHEDULE', 'REPLACE_CREATIVE', 'ARCHIVE_MAPPING');

-- CreateEnum
CREATE TYPE "AdvertisingTikTokAdsOperationStatus" AS ENUM ('PENDING', 'PREVIEWED', 'CONFIRMED', 'EXECUTING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "AdvertisingLinkedInAdsAccount" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "connectorAccountId" TEXT NOT NULL,
    "linkedInAccountId" TEXT NOT NULL,
    "linkedInAccountName" TEXT,
    "organizationUrn" TEXT,
    "currency" TEXT,
    "timezone" TEXT,
    "isTestAccount" BOOLEAN NOT NULL DEFAULT false,
    "status" "AdvertisingLinkedInAdsAccountStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3),
    "assignedByUserId" TEXT,
    "disconnectedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingLinkedInAdsAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingLinkedInAdsDraft" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "linkedInAdsAccountId" TEXT NOT NULL,
    "providerDraftId" TEXT,
    "objective" TEXT,
    "draftPayload" JSONB NOT NULL,
    "featureFlags" JSONB,
    "status" "AdvertisingLinkedInAdsDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "validationResult" JSONB,
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingLinkedInAdsDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingLinkedInAdsMutationPlan" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "planHash" TEXT NOT NULL,
    "operations" JSONB NOT NULL,
    "resourcesCreated" JSONB,
    "resourcesChanged" JSONB,
    "budgetSummary" JSONB,
    "accountSnapshot" JSONB,
    "targetingSummary" JSONB,
    "creativeSummary" JSONB,
    "trackingSummary" JSONB,
    "optimisationSummary" JSONB,
    "destinationSummary" JSONB,
    "providerWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "risks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "validationResult" JSONB,
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingLinkedInAdsMutationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingLinkedInAdsLaunchApproval" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "mutationPlanId" TEXT NOT NULL,
    "approvalType" TEXT NOT NULL,
    "planHash" TEXT NOT NULL,
    "decision" TEXT NOT NULL DEFAULT 'PENDING',
    "approverUserId" TEXT,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingLinkedInAdsLaunchApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingLinkedInAdsLaunch" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "mutationPlanId" TEXT NOT NULL,
    "linkedInAdsAccountId" TEXT NOT NULL,
    "planHash" TEXT NOT NULL,
    "launchVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "AdvertisingLinkedInAdsLaunchStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "policyStatus" TEXT,
    "policyRejectionReason" TEXT,
    "launchedByUserId" TEXT,
    "launchedAt" TIMESTAMP(3),
    "providerResponse" JSONB,
    "errorDetails" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "marketingCampaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingLinkedInAdsLaunch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingLinkedInAdsProviderResource" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "launchId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "internalRef" TEXT NOT NULL,
    "providerResourceId" TEXT,
    "providerResourceName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingLinkedInAdsProviderResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingLinkedInAdsOperation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "linkedInAdsAccountId" TEXT NOT NULL,
    "launchId" TEXT,
    "providerCampaignId" TEXT,
    "operationType" "AdvertisingLinkedInAdsOperationType" NOT NULL,
    "status" "AdvertisingLinkedInAdsOperationStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "preview" JSONB,
    "confirmation" JSONB,
    "providerResult" JSONB,
    "requestedByUserId" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingLinkedInAdsOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingTikTokAdsAccount" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "connectorAccountId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "advertiserName" TEXT,
    "pixelId" TEXT,
    "currency" TEXT,
    "timezone" TEXT,
    "isTestAccount" BOOLEAN NOT NULL DEFAULT false,
    "status" "AdvertisingTikTokAdsAccountStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3),
    "assignedByUserId" TEXT,
    "disconnectedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingTikTokAdsAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingTikTokAdsDraft" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "tikTokAdsAccountId" TEXT NOT NULL,
    "providerDraftId" TEXT,
    "objective" TEXT,
    "draftPayload" JSONB NOT NULL,
    "featureFlags" JSONB,
    "status" "AdvertisingTikTokAdsDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "validationResult" JSONB,
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingTikTokAdsDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingTikTokAdsMutationPlan" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "planHash" TEXT NOT NULL,
    "operations" JSONB NOT NULL,
    "resourcesCreated" JSONB,
    "resourcesChanged" JSONB,
    "budgetSummary" JSONB,
    "accountSnapshot" JSONB,
    "targetingSummary" JSONB,
    "creativeSummary" JSONB,
    "trackingSummary" JSONB,
    "optimisationSummary" JSONB,
    "destinationSummary" JSONB,
    "providerWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "risks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "validationResult" JSONB,
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingTikTokAdsMutationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingTikTokAdsLaunchApproval" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "mutationPlanId" TEXT NOT NULL,
    "approvalType" TEXT NOT NULL,
    "planHash" TEXT NOT NULL,
    "decision" TEXT NOT NULL DEFAULT 'PENDING',
    "approverUserId" TEXT,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingTikTokAdsLaunchApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingTikTokAdsLaunch" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "mutationPlanId" TEXT NOT NULL,
    "tikTokAdsAccountId" TEXT NOT NULL,
    "planHash" TEXT NOT NULL,
    "launchVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "AdvertisingTikTokAdsLaunchStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "policyStatus" TEXT,
    "policyRejectionReason" TEXT,
    "launchedByUserId" TEXT,
    "launchedAt" TIMESTAMP(3),
    "providerResponse" JSONB,
    "errorDetails" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "marketingCampaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingTikTokAdsLaunch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingTikTokAdsProviderResource" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "launchId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "internalRef" TEXT NOT NULL,
    "providerResourceId" TEXT,
    "providerResourceName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingTikTokAdsProviderResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingTikTokAdsOperation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "tikTokAdsAccountId" TEXT NOT NULL,
    "launchId" TEXT,
    "providerCampaignId" TEXT,
    "providerAdGroupId" TEXT,
    "operationType" "AdvertisingTikTokAdsOperationType" NOT NULL,
    "status" "AdvertisingTikTokAdsOperationStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "preview" JSONB,
    "confirmation" JSONB,
    "providerResult" JSONB,
    "requestedByUserId" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingTikTokAdsOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingLinkedInAdsAccount_brandId_key" ON "AdvertisingLinkedInAdsAccount"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingLinkedInAdsAccount_connectorAccountId_key" ON "AdvertisingLinkedInAdsAccount"("connectorAccountId");

-- CreateIndex
CREATE INDEX "AdvertisingLinkedInAdsAccount_organisationId_brandId_idx" ON "AdvertisingLinkedInAdsAccount"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "AdvertisingLinkedInAdsAccount_linkedInAccountId_idx" ON "AdvertisingLinkedInAdsAccount"("linkedInAccountId");

-- CreateIndex
CREATE INDEX "AdvertisingLinkedInAdsDraft_planId_idx" ON "AdvertisingLinkedInAdsDraft"("planId");

-- CreateIndex
CREATE INDEX "AdvertisingLinkedInAdsDraft_brandId_status_idx" ON "AdvertisingLinkedInAdsDraft"("brandId", "status");

-- CreateIndex
CREATE INDEX "AdvertisingLinkedInAdsMutationPlan_draftId_idx" ON "AdvertisingLinkedInAdsMutationPlan"("draftId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingLinkedInAdsMutationPlan_draftId_planHash_key" ON "AdvertisingLinkedInAdsMutationPlan"("draftId", "planHash");

-- CreateIndex
CREATE INDEX "AdvertisingLinkedInAdsLaunchApproval_mutationPlanId_approvalType_idx" ON "AdvertisingLinkedInAdsLaunchApproval"("mutationPlanId", "approvalType");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingLinkedInAdsLaunch_idempotencyKey_key" ON "AdvertisingLinkedInAdsLaunch"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AdvertisingLinkedInAdsLaunch_brandId_status_idx" ON "AdvertisingLinkedInAdsLaunch"("brandId", "status");

-- CreateIndex
CREATE INDEX "AdvertisingLinkedInAdsLaunch_planId_idx" ON "AdvertisingLinkedInAdsLaunch"("planId");

-- CreateIndex
CREATE INDEX "AdvertisingLinkedInAdsProviderResource_launchId_resourceType_idx" ON "AdvertisingLinkedInAdsProviderResource"("launchId", "resourceType");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingLinkedInAdsProviderResource_launchId_internalRef_key" ON "AdvertisingLinkedInAdsProviderResource"("launchId", "internalRef");

-- CreateIndex
CREATE INDEX "AdvertisingLinkedInAdsOperation_brandId_operationType_idx" ON "AdvertisingLinkedInAdsOperation"("brandId", "operationType");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingTikTokAdsAccount_brandId_key" ON "AdvertisingTikTokAdsAccount"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingTikTokAdsAccount_connectorAccountId_key" ON "AdvertisingTikTokAdsAccount"("connectorAccountId");

-- CreateIndex
CREATE INDEX "AdvertisingTikTokAdsAccount_organisationId_brandId_idx" ON "AdvertisingTikTokAdsAccount"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "AdvertisingTikTokAdsAccount_advertiserId_idx" ON "AdvertisingTikTokAdsAccount"("advertiserId");

-- CreateIndex
CREATE INDEX "AdvertisingTikTokAdsDraft_planId_idx" ON "AdvertisingTikTokAdsDraft"("planId");

-- CreateIndex
CREATE INDEX "AdvertisingTikTokAdsDraft_brandId_status_idx" ON "AdvertisingTikTokAdsDraft"("brandId", "status");

-- CreateIndex
CREATE INDEX "AdvertisingTikTokAdsMutationPlan_draftId_idx" ON "AdvertisingTikTokAdsMutationPlan"("draftId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingTikTokAdsMutationPlan_draftId_planHash_key" ON "AdvertisingTikTokAdsMutationPlan"("draftId", "planHash");

-- CreateIndex
CREATE INDEX "AdvertisingTikTokAdsLaunchApproval_mutationPlanId_approvalType_idx" ON "AdvertisingTikTokAdsLaunchApproval"("mutationPlanId", "approvalType");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingTikTokAdsLaunch_idempotencyKey_key" ON "AdvertisingTikTokAdsLaunch"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AdvertisingTikTokAdsLaunch_brandId_status_idx" ON "AdvertisingTikTokAdsLaunch"("brandId", "status");

-- CreateIndex
CREATE INDEX "AdvertisingTikTokAdsLaunch_planId_idx" ON "AdvertisingTikTokAdsLaunch"("planId");

-- CreateIndex
CREATE INDEX "AdvertisingTikTokAdsProviderResource_launchId_resourceType_idx" ON "AdvertisingTikTokAdsProviderResource"("launchId", "resourceType");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingTikTokAdsProviderResource_launchId_internalRef_key" ON "AdvertisingTikTokAdsProviderResource"("launchId", "internalRef");

-- CreateIndex
CREATE INDEX "AdvertisingTikTokAdsOperation_brandId_operationType_idx" ON "AdvertisingTikTokAdsOperation"("brandId", "operationType");

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsAccount" ADD CONSTRAINT "AdvertisingLinkedInAdsAccount_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsAccount" ADD CONSTRAINT "AdvertisingLinkedInAdsAccount_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsAccount" ADD CONSTRAINT "AdvertisingLinkedInAdsAccount_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsAccount" ADD CONSTRAINT "AdvertisingLinkedInAdsAccount_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "ConnectorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsAccount" ADD CONSTRAINT "AdvertisingLinkedInAdsAccount_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsDraft" ADD CONSTRAINT "AdvertisingLinkedInAdsDraft_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsDraft" ADD CONSTRAINT "AdvertisingLinkedInAdsDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsDraft" ADD CONSTRAINT "AdvertisingLinkedInAdsDraft_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsDraft" ADD CONSTRAINT "AdvertisingLinkedInAdsDraft_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsDraft" ADD CONSTRAINT "AdvertisingLinkedInAdsDraft_linkedInAdsAccountId_fkey" FOREIGN KEY ("linkedInAdsAccountId") REFERENCES "AdvertisingLinkedInAdsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsDraft" ADD CONSTRAINT "AdvertisingLinkedInAdsDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsMutationPlan" ADD CONSTRAINT "AdvertisingLinkedInAdsMutationPlan_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsMutationPlan" ADD CONSTRAINT "AdvertisingLinkedInAdsMutationPlan_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "AdvertisingLinkedInAdsDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsMutationPlan" ADD CONSTRAINT "AdvertisingLinkedInAdsMutationPlan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsLaunchApproval" ADD CONSTRAINT "AdvertisingLinkedInAdsLaunchApproval_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsLaunchApproval" ADD CONSTRAINT "AdvertisingLinkedInAdsLaunchApproval_mutationPlanId_fkey" FOREIGN KEY ("mutationPlanId") REFERENCES "AdvertisingLinkedInAdsMutationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsLaunchApproval" ADD CONSTRAINT "AdvertisingLinkedInAdsLaunchApproval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsLaunch" ADD CONSTRAINT "AdvertisingLinkedInAdsLaunch_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsLaunch" ADD CONSTRAINT "AdvertisingLinkedInAdsLaunch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsLaunch" ADD CONSTRAINT "AdvertisingLinkedInAdsLaunch_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsLaunch" ADD CONSTRAINT "AdvertisingLinkedInAdsLaunch_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsLaunch" ADD CONSTRAINT "AdvertisingLinkedInAdsLaunch_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "AdvertisingLinkedInAdsDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsLaunch" ADD CONSTRAINT "AdvertisingLinkedInAdsLaunch_mutationPlanId_fkey" FOREIGN KEY ("mutationPlanId") REFERENCES "AdvertisingLinkedInAdsMutationPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsLaunch" ADD CONSTRAINT "AdvertisingLinkedInAdsLaunch_linkedInAdsAccountId_fkey" FOREIGN KEY ("linkedInAdsAccountId") REFERENCES "AdvertisingLinkedInAdsAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsLaunch" ADD CONSTRAINT "AdvertisingLinkedInAdsLaunch_launchedByUserId_fkey" FOREIGN KEY ("launchedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsLaunch" ADD CONSTRAINT "AdvertisingLinkedInAdsLaunch_marketingCampaignId_fkey" FOREIGN KEY ("marketingCampaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsProviderResource" ADD CONSTRAINT "AdvertisingLinkedInAdsProviderResource_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsProviderResource" ADD CONSTRAINT "AdvertisingLinkedInAdsProviderResource_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "AdvertisingLinkedInAdsLaunch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsOperation" ADD CONSTRAINT "AdvertisingLinkedInAdsOperation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsOperation" ADD CONSTRAINT "AdvertisingLinkedInAdsOperation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsOperation" ADD CONSTRAINT "AdvertisingLinkedInAdsOperation_linkedInAdsAccountId_fkey" FOREIGN KEY ("linkedInAdsAccountId") REFERENCES "AdvertisingLinkedInAdsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingLinkedInAdsOperation" ADD CONSTRAINT "AdvertisingLinkedInAdsOperation_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsAccount" ADD CONSTRAINT "AdvertisingTikTokAdsAccount_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsAccount" ADD CONSTRAINT "AdvertisingTikTokAdsAccount_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsAccount" ADD CONSTRAINT "AdvertisingTikTokAdsAccount_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsAccount" ADD CONSTRAINT "AdvertisingTikTokAdsAccount_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "ConnectorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsAccount" ADD CONSTRAINT "AdvertisingTikTokAdsAccount_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsDraft" ADD CONSTRAINT "AdvertisingTikTokAdsDraft_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsDraft" ADD CONSTRAINT "AdvertisingTikTokAdsDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsDraft" ADD CONSTRAINT "AdvertisingTikTokAdsDraft_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsDraft" ADD CONSTRAINT "AdvertisingTikTokAdsDraft_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsDraft" ADD CONSTRAINT "AdvertisingTikTokAdsDraft_tikTokAdsAccountId_fkey" FOREIGN KEY ("tikTokAdsAccountId") REFERENCES "AdvertisingTikTokAdsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsDraft" ADD CONSTRAINT "AdvertisingTikTokAdsDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsMutationPlan" ADD CONSTRAINT "AdvertisingTikTokAdsMutationPlan_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsMutationPlan" ADD CONSTRAINT "AdvertisingTikTokAdsMutationPlan_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "AdvertisingTikTokAdsDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsMutationPlan" ADD CONSTRAINT "AdvertisingTikTokAdsMutationPlan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsLaunchApproval" ADD CONSTRAINT "AdvertisingTikTokAdsLaunchApproval_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsLaunchApproval" ADD CONSTRAINT "AdvertisingTikTokAdsLaunchApproval_mutationPlanId_fkey" FOREIGN KEY ("mutationPlanId") REFERENCES "AdvertisingTikTokAdsMutationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsLaunchApproval" ADD CONSTRAINT "AdvertisingTikTokAdsLaunchApproval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsLaunch" ADD CONSTRAINT "AdvertisingTikTokAdsLaunch_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsLaunch" ADD CONSTRAINT "AdvertisingTikTokAdsLaunch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsLaunch" ADD CONSTRAINT "AdvertisingTikTokAdsLaunch_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsLaunch" ADD CONSTRAINT "AdvertisingTikTokAdsLaunch_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsLaunch" ADD CONSTRAINT "AdvertisingTikTokAdsLaunch_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "AdvertisingTikTokAdsDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsLaunch" ADD CONSTRAINT "AdvertisingTikTokAdsLaunch_mutationPlanId_fkey" FOREIGN KEY ("mutationPlanId") REFERENCES "AdvertisingTikTokAdsMutationPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsLaunch" ADD CONSTRAINT "AdvertisingTikTokAdsLaunch_tikTokAdsAccountId_fkey" FOREIGN KEY ("tikTokAdsAccountId") REFERENCES "AdvertisingTikTokAdsAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsLaunch" ADD CONSTRAINT "AdvertisingTikTokAdsLaunch_launchedByUserId_fkey" FOREIGN KEY ("launchedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsLaunch" ADD CONSTRAINT "AdvertisingTikTokAdsLaunch_marketingCampaignId_fkey" FOREIGN KEY ("marketingCampaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsProviderResource" ADD CONSTRAINT "AdvertisingTikTokAdsProviderResource_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsProviderResource" ADD CONSTRAINT "AdvertisingTikTokAdsProviderResource_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "AdvertisingTikTokAdsLaunch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsOperation" ADD CONSTRAINT "AdvertisingTikTokAdsOperation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsOperation" ADD CONSTRAINT "AdvertisingTikTokAdsOperation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsOperation" ADD CONSTRAINT "AdvertisingTikTokAdsOperation_tikTokAdsAccountId_fkey" FOREIGN KEY ("tikTokAdsAccountId") REFERENCES "AdvertisingTikTokAdsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingTikTokAdsOperation" ADD CONSTRAINT "AdvertisingTikTokAdsOperation_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
