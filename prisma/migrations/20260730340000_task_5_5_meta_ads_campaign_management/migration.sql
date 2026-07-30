-- Task 5.5: Controlled Meta Ads Campaign Management

-- CreateEnum
CREATE TYPE "AdvertisingMetaAdsAccountStatus" AS ENUM ('PENDING', 'CONNECTED', 'DISCONNECTED', 'PERMISSION_LOST', 'ASSET_MISMATCH');

-- CreateEnum
CREATE TYPE "AdvertisingMetaAdsDraftStatus" AS ENUM ('DRAFT', 'VALIDATED', 'STALE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdvertisingMetaAdsLaunchStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'LAUNCHING', 'LAUNCHED', 'PARTIAL_SUCCESS', 'FAILED', 'STALE_APPROVAL', 'POLICY_REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdvertisingMetaAdsOperationType" AS ENUM ('PAUSE_CAMPAIGN', 'RESUME_CAMPAIGN', 'PAUSE_AD_SET', 'RESUME_AD_SET', 'ADJUST_BUDGET', 'UPDATE_SCHEDULE', 'REPLACE_CREATIVE', 'ARCHIVE_MAPPING');

-- CreateEnum
CREATE TYPE "AdvertisingMetaAdsOperationStatus" AS ENUM ('PENDING', 'PREVIEWED', 'CONFIRMED', 'EXECUTING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AdvertisingMetaAdsCapiEventStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED_NO_CONSENT');

-- CreateTable
CREATE TABLE "AdvertisingMetaAdsAccount" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "connectorAccountId" TEXT NOT NULL,
    "businessId" TEXT,
    "businessName" TEXT,
    "adAccountId" TEXT NOT NULL,
    "adAccountName" TEXT,
    "facebookPageId" TEXT,
    "facebookPageName" TEXT,
    "instagramAccountId" TEXT,
    "instagramUsername" TEXT,
    "pixelId" TEXT,
    "datasetId" TEXT,
    "currency" TEXT,
    "timezone" TEXT,
    "isTestAccount" BOOLEAN NOT NULL DEFAULT false,
    "status" "AdvertisingMetaAdsAccountStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3),
    "assignedByUserId" TEXT,
    "disconnectedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingMetaAdsAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingMetaAdsDraft" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "metaAdsAccountId" TEXT NOT NULL,
    "providerDraftId" TEXT,
    "channelTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "objective" TEXT,
    "draftPayload" JSONB NOT NULL,
    "featureFlags" JSONB,
    "status" "AdvertisingMetaAdsDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "validationResult" JSONB,
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingMetaAdsDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingMetaAdsMutationPlan" (
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
    "risks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "validationResult" JSONB,
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingMetaAdsMutationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingMetaAdsLaunchApproval" (
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

    CONSTRAINT "AdvertisingMetaAdsLaunchApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingMetaAdsLaunch" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "mutationPlanId" TEXT NOT NULL,
    "metaAdsAccountId" TEXT NOT NULL,
    "planHash" TEXT NOT NULL,
    "launchVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "AdvertisingMetaAdsLaunchStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
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

    CONSTRAINT "AdvertisingMetaAdsLaunch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingMetaAdsProviderResource" (
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

    CONSTRAINT "AdvertisingMetaAdsProviderResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingMetaAdsOperation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "metaAdsAccountId" TEXT NOT NULL,
    "launchId" TEXT,
    "providerCampaignId" TEXT,
    "providerAdSetId" TEXT,
    "operationType" "AdvertisingMetaAdsOperationType" NOT NULL,
    "status" "AdvertisingMetaAdsOperationStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "preview" JSONB,
    "confirmation" JSONB,
    "providerResult" JSONB,
    "requestedByUserId" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingMetaAdsOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingMetaAdsCapiEvent" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "metaAdsAccountId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL,
    "consentState" TEXT NOT NULL,
    "hashedUserData" JSONB,
    "browserEventId" TEXT,
    "status" "AdvertisingMetaAdsCapiEventStatus" NOT NULL DEFAULT 'PENDING',
    "providerResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingMetaAdsCapiEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingMetaAdsAccount_brandId_key" ON "AdvertisingMetaAdsAccount"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingMetaAdsAccount_connectorAccountId_key" ON "AdvertisingMetaAdsAccount"("connectorAccountId");

-- CreateIndex
CREATE INDEX "AdvertisingMetaAdsAccount_organisationId_brandId_idx" ON "AdvertisingMetaAdsAccount"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "AdvertisingMetaAdsAccount_adAccountId_idx" ON "AdvertisingMetaAdsAccount"("adAccountId");

-- CreateIndex
CREATE INDEX "AdvertisingMetaAdsDraft_planId_idx" ON "AdvertisingMetaAdsDraft"("planId");

-- CreateIndex
CREATE INDEX "AdvertisingMetaAdsDraft_brandId_status_idx" ON "AdvertisingMetaAdsDraft"("brandId", "status");

-- CreateIndex
CREATE INDEX "AdvertisingMetaAdsMutationPlan_draftId_idx" ON "AdvertisingMetaAdsMutationPlan"("draftId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingMetaAdsMutationPlan_draftId_planHash_key" ON "AdvertisingMetaAdsMutationPlan"("draftId", "planHash");

-- CreateIndex
CREATE INDEX "AdvertisingMetaAdsLaunchApproval_mutationPlanId_approvalType_idx" ON "AdvertisingMetaAdsLaunchApproval"("mutationPlanId", "approvalType");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingMetaAdsLaunch_idempotencyKey_key" ON "AdvertisingMetaAdsLaunch"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AdvertisingMetaAdsLaunch_brandId_status_idx" ON "AdvertisingMetaAdsLaunch"("brandId", "status");

-- CreateIndex
CREATE INDEX "AdvertisingMetaAdsLaunch_planId_idx" ON "AdvertisingMetaAdsLaunch"("planId");

-- CreateIndex
CREATE INDEX "AdvertisingMetaAdsProviderResource_launchId_resourceType_idx" ON "AdvertisingMetaAdsProviderResource"("launchId", "resourceType");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingMetaAdsProviderResource_launchId_internalRef_key" ON "AdvertisingMetaAdsProviderResource"("launchId", "internalRef");

-- CreateIndex
CREATE INDEX "AdvertisingMetaAdsOperation_brandId_operationType_idx" ON "AdvertisingMetaAdsOperation"("brandId", "operationType");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingMetaAdsCapiEvent_metaAdsAccountId_eventId_key" ON "AdvertisingMetaAdsCapiEvent"("metaAdsAccountId", "eventId");

-- CreateIndex
CREATE INDEX "AdvertisingMetaAdsCapiEvent_brandId_status_idx" ON "AdvertisingMetaAdsCapiEvent"("brandId", "status");

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsAccount" ADD CONSTRAINT "AdvertisingMetaAdsAccount_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsAccount" ADD CONSTRAINT "AdvertisingMetaAdsAccount_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsAccount" ADD CONSTRAINT "AdvertisingMetaAdsAccount_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsAccount" ADD CONSTRAINT "AdvertisingMetaAdsAccount_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "ConnectorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsAccount" ADD CONSTRAINT "AdvertisingMetaAdsAccount_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsDraft" ADD CONSTRAINT "AdvertisingMetaAdsDraft_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsDraft" ADD CONSTRAINT "AdvertisingMetaAdsDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsDraft" ADD CONSTRAINT "AdvertisingMetaAdsDraft_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsDraft" ADD CONSTRAINT "AdvertisingMetaAdsDraft_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsDraft" ADD CONSTRAINT "AdvertisingMetaAdsDraft_metaAdsAccountId_fkey" FOREIGN KEY ("metaAdsAccountId") REFERENCES "AdvertisingMetaAdsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsDraft" ADD CONSTRAINT "AdvertisingMetaAdsDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsMutationPlan" ADD CONSTRAINT "AdvertisingMetaAdsMutationPlan_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsMutationPlan" ADD CONSTRAINT "AdvertisingMetaAdsMutationPlan_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "AdvertisingMetaAdsDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsMutationPlan" ADD CONSTRAINT "AdvertisingMetaAdsMutationPlan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsLaunchApproval" ADD CONSTRAINT "AdvertisingMetaAdsLaunchApproval_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsLaunchApproval" ADD CONSTRAINT "AdvertisingMetaAdsLaunchApproval_mutationPlanId_fkey" FOREIGN KEY ("mutationPlanId") REFERENCES "AdvertisingMetaAdsMutationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsLaunchApproval" ADD CONSTRAINT "AdvertisingMetaAdsLaunchApproval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsLaunch" ADD CONSTRAINT "AdvertisingMetaAdsLaunch_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsLaunch" ADD CONSTRAINT "AdvertisingMetaAdsLaunch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsLaunch" ADD CONSTRAINT "AdvertisingMetaAdsLaunch_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsLaunch" ADD CONSTRAINT "AdvertisingMetaAdsLaunch_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdvertisingCampaignPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsLaunch" ADD CONSTRAINT "AdvertisingMetaAdsLaunch_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "AdvertisingMetaAdsDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsLaunch" ADD CONSTRAINT "AdvertisingMetaAdsLaunch_mutationPlanId_fkey" FOREIGN KEY ("mutationPlanId") REFERENCES "AdvertisingMetaAdsMutationPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsLaunch" ADD CONSTRAINT "AdvertisingMetaAdsLaunch_metaAdsAccountId_fkey" FOREIGN KEY ("metaAdsAccountId") REFERENCES "AdvertisingMetaAdsAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsLaunch" ADD CONSTRAINT "AdvertisingMetaAdsLaunch_launchedByUserId_fkey" FOREIGN KEY ("launchedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsLaunch" ADD CONSTRAINT "AdvertisingMetaAdsLaunch_marketingCampaignId_fkey" FOREIGN KEY ("marketingCampaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsProviderResource" ADD CONSTRAINT "AdvertisingMetaAdsProviderResource_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsProviderResource" ADD CONSTRAINT "AdvertisingMetaAdsProviderResource_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "AdvertisingMetaAdsLaunch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsOperation" ADD CONSTRAINT "AdvertisingMetaAdsOperation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsOperation" ADD CONSTRAINT "AdvertisingMetaAdsOperation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsOperation" ADD CONSTRAINT "AdvertisingMetaAdsOperation_metaAdsAccountId_fkey" FOREIGN KEY ("metaAdsAccountId") REFERENCES "AdvertisingMetaAdsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsOperation" ADD CONSTRAINT "AdvertisingMetaAdsOperation_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsCapiEvent" ADD CONSTRAINT "AdvertisingMetaAdsCapiEvent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsCapiEvent" ADD CONSTRAINT "AdvertisingMetaAdsCapiEvent_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMetaAdsCapiEvent" ADD CONSTRAINT "AdvertisingMetaAdsCapiEvent_metaAdsAccountId_fkey" FOREIGN KEY ("metaAdsAccountId") REFERENCES "AdvertisingMetaAdsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
