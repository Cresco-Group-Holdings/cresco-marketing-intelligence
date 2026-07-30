-- Task 3.5: Paid advertising intelligence — MarketingCreative and creative linking

CREATE TYPE "PaidAdsCreativeMappingSource" AS ENUM ('EXPLICIT_USER_MAPPING', 'DETERMINISTIC_PROVIDER_ID');

ALTER TABLE "MarketingAd" ADD COLUMN "contentItemId" TEXT;
ALTER TABLE "MarketingAd" ADD COLUMN "contentVariantId" TEXT;
ALTER TABLE "MarketingAd" ADD COLUMN "marketingAssetId" TEXT;

CREATE TABLE "MarketingCreative" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT,
    "marketingAdId" TEXT,
    "provider" "MarketingDataProvider" NOT NULL,
    "providerCreativeId" TEXT NOT NULL,
    "name" TEXT,
    "creativeType" TEXT,
    "status" "MarketingDimensionStatus" NOT NULL DEFAULT 'ACTIVE',
    "providerMetadata" JSONB,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCreative_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaidAdsCreativeMapping" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "provider" "MarketingDataProvider" NOT NULL,
    "providerCreativeId" TEXT NOT NULL,
    "providerAdId" TEXT,
    "marketingCreativeId" TEXT,
    "contentItemId" TEXT,
    "contentVariantId" TEXT,
    "marketingAssetId" TEXT,
    "mappingSource" "PaidAdsCreativeMappingSource" NOT NULL,
    "mappingKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaidAdsCreativeMapping_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MarketingMetricObservation" ADD COLUMN "marketingCreativeId" TEXT;

CREATE UNIQUE INDEX "MarketingCreative_brandId_provider_providerCreativeId_key" ON "MarketingCreative"("brandId", "provider", "providerCreativeId");
CREATE INDEX "MarketingCreative_organisationId_brandId_idx" ON "MarketingCreative"("organisationId", "brandId");
CREATE INDEX "MarketingCreative_marketingAdId_idx" ON "MarketingCreative"("marketingAdId");
CREATE INDEX "MarketingCreative_status_idx" ON "MarketingCreative"("status");

CREATE UNIQUE INDEX "PaidAdsCreativeMapping_brandId_provider_providerCreativeId_key" ON "PaidAdsCreativeMapping"("brandId", "provider", "providerCreativeId");
CREATE INDEX "PaidAdsCreativeMapping_organisationId_brandId_idx" ON "PaidAdsCreativeMapping"("organisationId", "brandId");
CREATE INDEX "PaidAdsCreativeMapping_contentItemId_idx" ON "PaidAdsCreativeMapping"("contentItemId");
CREATE INDEX "PaidAdsCreativeMapping_contentVariantId_idx" ON "PaidAdsCreativeMapping"("contentVariantId");
CREATE INDEX "PaidAdsCreativeMapping_marketingAssetId_idx" ON "PaidAdsCreativeMapping"("marketingAssetId");

CREATE INDEX "MarketingAd_contentItemId_idx" ON "MarketingAd"("contentItemId");

ALTER TABLE "MarketingAd" ADD CONSTRAINT "MarketingAd_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingAd" ADD CONSTRAINT "MarketingAd_contentVariantId_fkey" FOREIGN KEY ("contentVariantId") REFERENCES "ContentVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingAd" ADD CONSTRAINT "MarketingAd_marketingAssetId_fkey" FOREIGN KEY ("marketingAssetId") REFERENCES "MarketingAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingCreative" ADD CONSTRAINT "MarketingCreative_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingCreative" ADD CONSTRAINT "MarketingCreative_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingCreative" ADD CONSTRAINT "MarketingCreative_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingCreative" ADD CONSTRAINT "MarketingCreative_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingCreative" ADD CONSTRAINT "MarketingCreative_marketingAdId_fkey" FOREIGN KEY ("marketingAdId") REFERENCES "MarketingAd"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaidAdsCreativeMapping" ADD CONSTRAINT "PaidAdsCreativeMapping_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaidAdsCreativeMapping" ADD CONSTRAINT "PaidAdsCreativeMapping_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaidAdsCreativeMapping" ADD CONSTRAINT "PaidAdsCreativeMapping_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaidAdsCreativeMapping" ADD CONSTRAINT "PaidAdsCreativeMapping_marketingCreativeId_fkey" FOREIGN KEY ("marketingCreativeId") REFERENCES "MarketingCreative"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaidAdsCreativeMapping" ADD CONSTRAINT "PaidAdsCreativeMapping_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaidAdsCreativeMapping" ADD CONSTRAINT "PaidAdsCreativeMapping_contentVariantId_fkey" FOREIGN KEY ("contentVariantId") REFERENCES "ContentVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaidAdsCreativeMapping" ADD CONSTRAINT "PaidAdsCreativeMapping_marketingAssetId_fkey" FOREIGN KEY ("marketingAssetId") REFERENCES "MarketingAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingMetricObservation" ADD CONSTRAINT "MarketingMetricObservation_marketingCreativeId_fkey" FOREIGN KEY ("marketingCreativeId") REFERENCES "MarketingCreative"("id") ON DELETE SET NULL ON UPDATE CASCADE;
