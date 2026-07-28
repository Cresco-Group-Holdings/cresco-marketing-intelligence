-- CreateEnum
CREATE TYPE "MarketingObjectiveType" AS ENUM ('BRAND_AWARENESS', 'WEBSITE_TRAFFIC', 'LEAD_GENERATION', 'DEMO_BOOKINGS', 'TRIAL_SIGNUPS', 'PAID_SUBSCRIPTIONS', 'COMMUNITY_GROWTH', 'EMAIL_LIST_GROWTH', 'SEO_GROWTH', 'CUSTOMER_RETENTION');

-- CreateEnum
CREATE TYPE "MarketingObjectiveStatus" AS ENUM ('PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MarketingChannel" AS ENUM ('WEBSITE', 'SEO', 'GOOGLE_ADS', 'LINKEDIN', 'INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'YOUTUBE', 'X', 'EMAIL');

-- CreateEnum
CREATE TYPE "OnboardingStepKey" AS ENUM ('ACCOUNT_PROFILE', 'ORGANISATION', 'PROJECT', 'BRAND', 'BRAND_PROFILE', 'MARKETING_OBJECTIVES', 'CHANNEL_PREFERENCES', 'REVIEW');

-- CreateTable
CREATE TABLE "MarketingObjective" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "objectiveType" "MarketingObjectiveType" NOT NULL,
    "description" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "targetValue" DECIMAL(18,4) NOT NULL,
    "targetPeriod" TEXT NOT NULL,
    "status" "MarketingObjectiveStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandChannelPreference" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "channel" "MarketingChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandChannelPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organisationId" TEXT,
    "projectId" TEXT,
    "brandId" TEXT,
    "currentStep" "OnboardingStepKey" NOT NULL DEFAULT 'ACCOUNT_PROFILE',
    "completedSteps" "OnboardingStepKey"[] DEFAULT ARRAY[]::"OnboardingStepKey"[],
    "stepData" JSONB,
    "templateKey" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingObjective_organisationId_idx" ON "MarketingObjective"("organisationId");

-- CreateIndex
CREATE INDEX "MarketingObjective_projectId_idx" ON "MarketingObjective"("projectId");

-- CreateIndex
CREATE INDEX "MarketingObjective_brandId_idx" ON "MarketingObjective"("brandId");

-- CreateIndex
CREATE INDEX "MarketingObjective_status_idx" ON "MarketingObjective"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingObjective_brandId_objectiveType_key" ON "MarketingObjective"("brandId", "objectiveType");

-- CreateIndex
CREATE INDEX "BrandChannelPreference_organisationId_idx" ON "BrandChannelPreference"("organisationId");

-- CreateIndex
CREATE INDEX "BrandChannelPreference_projectId_idx" ON "BrandChannelPreference"("projectId");

-- CreateIndex
CREATE INDEX "BrandChannelPreference_brandId_idx" ON "BrandChannelPreference"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandChannelPreference_brandId_channel_key" ON "BrandChannelPreference"("brandId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingProgress_userId_key" ON "OnboardingProgress"("userId");

-- CreateIndex
CREATE INDEX "OnboardingProgress_organisationId_idx" ON "OnboardingProgress"("organisationId");

-- CreateIndex
CREATE INDEX "OnboardingProgress_projectId_idx" ON "OnboardingProgress"("projectId");

-- CreateIndex
CREATE INDEX "OnboardingProgress_brandId_idx" ON "OnboardingProgress"("brandId");

-- CreateIndex
CREATE INDEX "OnboardingProgress_currentStep_idx" ON "OnboardingProgress"("currentStep");

-- AddForeignKey
ALTER TABLE "MarketingObjective" ADD CONSTRAINT "MarketingObjective_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingObjective" ADD CONSTRAINT "MarketingObjective_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingObjective" ADD CONSTRAINT "MarketingObjective_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandChannelPreference" ADD CONSTRAINT "BrandChannelPreference_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandChannelPreference" ADD CONSTRAINT "BrandChannelPreference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandChannelPreference" ADD CONSTRAINT "BrandChannelPreference_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
