-- Task 5.4: Controlled Google Ads Campaign Management

-- CreateEnum
CREATE TYPE "AdvertisingGoogleAdsAccountStatus" AS ENUM ('PENDING', 'CONNECTED', 'DISCONNECTED', 'PERMISSION_LOST');

-- CreateEnum
CREATE TYPE "AdvertisingGoogleAdsDraftStatus" AS ENUM ('DRAFT', 'VALIDATED', 'STALE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdvertisingGoogleAdsLaunchStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'LAUNCHING', 'LAUNCHED', 'PARTIAL_SUCCESS', 'FAILED', 'STALE_APPROVAL', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdvertisingGoogleAdsOperationType" AS ENUM ('PAUSE_CAMPAIGN', 'RESUME_CAMPAIGN', 'ADJUST_BUDGET', 'UPDATE_STATUS', 'ARCHIVE_MAPPING');

-- CreateEnum
CREATE TYPE "AdvertisingGoogleAdsOperationStatus" AS ENUM ('PENDING', 'PREVIEWED', 'CONFIRMED', 'EXECUTING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "AdvertisingGoogleAdsAccount" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "connectorAccountId" TEXT NOT NULL,
    "managerCustomerId" TEXT,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT,
    "currency" TEXT,
    "timezone" TEXT,
    "accessLevel" TEXT,
    "isTestAccount" BOOLEAN NOT NULL DEFAULT false,
    "status" "AdvertisingGoogleAdsAccountStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3),
    "assignedByUserId" TEXT,
    "disconnectedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingGoogleAdsAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingGoogleAdsDraft" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "googleAdsAccountId" TEXT NOT NULL,
    "providerDraftId" TEXT,
    "campaignType" TEXT NOT NULL DEFAULT 'SEARCH',
    "draftPayload" JSONB NOT NULL,
    "featureFlags" JSONB,
    "status" "AdvertisingGoogleAdsDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "validationResult" JSONB,
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingGoogleAdsDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingGoogleAdsMutationPlan" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "planHash" TEXT NOT NULL,
    "operations" JSONB NOT NULL,
    "resourcesCreated" JSONB,
    "resourcesChanged" JSONB,
    "budgetSummary" JSONB,
    "accountSnapshot" JSONB,
    "destinationSummary" JSONB,
    "risks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "validationResult" JSONB,
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingGoogleAdsMutationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingGoogleAdsLaunchApproval" (
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

    CONSTRAINT "AdvertisingGoogleAdsLaunchApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingGoogleAdsLaunch" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "mutationPlanId" TEXT NOT NULL,
    "googleAdsAccountId" TEXT NOT NULL,
    "planHash" TEXT NOT NULL,
    "launchVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "AdvertisingGoogleAdsLaunchStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "launchedByUserId" TEXT,
    "launchedAt" TIMESTAMP(3),
    "providerResponse" JSONB,
    "errorDetails" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "marketingCampaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingGoogleAdsLaunch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingGoogleAdsProviderResource" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "launchId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "internalRef" TEXT NOT NULL,
    "providerResourceName" TEXT,
    "providerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingGoogleAdsProviderResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingGoogleAdsOperation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "googleAdsAccountId" TEXT NOT NULL,
    "launchId" TEXT,
    "providerCampaignId" TEXT,
    "operationType" "AdvertisingGoogleAdsOperationType" NOT NULL,
    "status" "AdvertisingGoogleAdsOperationStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "preview" JSONB,
    "confirmation" JSONB,
    "providerResult" JSONB,
    "requestedByUserId" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingGoogleAdsOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingGoogleAdsAccount_brandId_key" ON "AdvertisingGoogleAdsAccount"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingGoogleAdsAccount_connectorAccountId_key" ON "AdvertisingGoogleAdsAccount"("connectorAccountId");

-- CreateIndex
CREATE INDEX "AdvertisingGoogleAdsAccount_organisationId_brandId_idx" ON "AdvertisingGoogleAdsAccount"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "AdvertisingGoogleAdsAccount_customerId_idx" ON "AdvertisingGoogleAdsAccount"("customerId");

-- CreateIndex
CREATE INDEX "AdvertisingGoogleAdsDraft_planId_idx" ON "AdvertisingGoogleAdsDraft"("planId");

-- CreateIndex
CREATE INDEX "AdvertisingGoogleAdsDraft_brandId_status_idx" ON "AdvertisingGoogleAdsDraft"("brandId", "status");

-- CreateIndex
CREATE INDEX "AdvertisingGoogleAdsMutationPlan_draftId_idx" ON "AdvertisingGoogleAdsMutationPlan"("draftId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingGoogleAdsMutationPlan_draftId_planHash_key" ON "AdvertisingGoogleAdsMutationPlan"("draftId", "planHash");

-- CreateIndex
CREATE INDEX "AdvertisingGoogleAdsLaunchApproval_mutationPlanId_approvalT_idx" ON "AdvertisingGoogleAdsLaunchApproval"("mutationPlanId", "approvalType");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingGoogleAdsLaunch_idempotencyKey_key" ON "AdvertisingGoogleAdsLaunch"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AdvertisingGoogleAdsLaunch_brandId_status_idx" ON "AdvertisingGoogleAdsLaunch"("brandId", "status");

-- CreateIndex
CREATE INDEX "AdvertisingGoogleAdsLaunch_planId_idx" ON "AdvertisingGoogleAdsLaunch"("planId");

-- CreateIndex
CREATE INDEX "AdvertisingGoogleAdsProviderResource_launchId_resourceType_idx" ON "AdvertisingGoogleAdsProviderResource"("launchId", "resourceType");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingGoogleAdsProviderResource_launchId_internalRef_key" ON "AdvertisingGoogleAdsProviderResource"("launchId", "internalRef");

-- CreateIndex
CREATE INDEX "AdvertisingGoogleAdsOperation_brandId_operationType_idx" ON "AdvertisingGoogleAdsOperation"("brandId", "operationType");
-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsAccount" ADD CONSTRAINT "AdvertisingGoogleAdsAccount_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsAccount" ADD CONSTRAINT "AdvertisingGoogleAdsAccount_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsAccount" ADD CONSTRAINT "AdvertisingGoogleAdsAccount_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsAccount" ADD CONSTRAINT "AdvertisingGoogleAdsAccount_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "ConnectorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsAccount" ADD CONSTRAINT "AdvertisingGoogleAdsAccount_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsDraft" ADD CONSTRAINT "AdvertisingGoogleAdsDraft_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsDraft" ADD CONSTRAINT "AdvertisingGoogleAdsDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsDraft" ADD CONSTRAINT "AdvertisingGoogleAdsDraft_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsDraft" ADD CONSTRAINT "AdvertisingGoogleAdsDraft_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsDraft" ADD CONSTRAINT "AdvertisingGoogleAdsDraft_googleAdsAccountId_fkey" FOREIGN KEY ("googleAdsAccountId") REFERENCES "AdvertisingGoogleAdsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsDraft" ADD CONSTRAINT "AdvertisingGoogleAdsDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsMutationPlan" ADD CONSTRAINT "AdvertisingGoogleAdsMutationPlan_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsMutationPlan" ADD CONSTRAINT "AdvertisingGoogleAdsMutationPlan_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "AdvertisingGoogleAdsDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsMutationPlan" ADD CONSTRAINT "AdvertisingGoogleAdsMutationPlan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsLaunchApproval" ADD CONSTRAINT "AdvertisingGoogleAdsLaunchApproval_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsLaunchApproval" ADD CONSTRAINT "AdvertisingGoogleAdsLaunchApproval_mutationPlanId_fkey" FOREIGN KEY ("mutationPlanId") REFERENCES "AdvertisingGoogleAdsMutationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsLaunchApproval" ADD CONSTRAINT "AdvertisingGoogleAdsLaunchApproval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsLaunch" ADD CONSTRAINT "AdvertisingGoogleAdsLaunch_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsLaunch" ADD CONSTRAINT "AdvertisingGoogleAdsLaunch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsLaunch" ADD CONSTRAINT "AdvertisingGoogleAdsLaunch_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsLaunch" ADD CONSTRAINT "AdvertisingGoogleAdsLaunch_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsLaunch" ADD CONSTRAINT "AdvertisingGoogleAdsLaunch_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "AdvertisingGoogleAdsDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsLaunch" ADD CONSTRAINT "AdvertisingGoogleAdsLaunch_mutationPlanId_fkey" FOREIGN KEY ("mutationPlanId") REFERENCES "AdvertisingGoogleAdsMutationPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsLaunch" ADD CONSTRAINT "AdvertisingGoogleAdsLaunch_googleAdsAccountId_fkey" FOREIGN KEY ("googleAdsAccountId") REFERENCES "AdvertisingGoogleAdsAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsLaunch" ADD CONSTRAINT "AdvertisingGoogleAdsLaunch_launchedByUserId_fkey" FOREIGN KEY ("launchedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsLaunch" ADD CONSTRAINT "AdvertisingGoogleAdsLaunch_marketingCampaignId_fkey" FOREIGN KEY ("marketingCampaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsProviderResource" ADD CONSTRAINT "AdvertisingGoogleAdsProviderResource_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsProviderResource" ADD CONSTRAINT "AdvertisingGoogleAdsProviderResource_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "AdvertisingGoogleAdsLaunch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsOperation" ADD CONSTRAINT "AdvertisingGoogleAdsOperation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsOperation" ADD CONSTRAINT "AdvertisingGoogleAdsOperation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsOperation" ADD CONSTRAINT "AdvertisingGoogleAdsOperation_googleAdsAccountId_fkey" FOREIGN KEY ("googleAdsAccountId") REFERENCES "AdvertisingGoogleAdsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingGoogleAdsOperation" ADD CONSTRAINT "AdvertisingGoogleAdsOperation_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
