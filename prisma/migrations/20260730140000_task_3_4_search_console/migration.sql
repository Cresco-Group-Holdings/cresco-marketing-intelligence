-- Task 3.4: Search Console SEO dimensions

CREATE TABLE "MarketingSearchQuery" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT,
    "provider" "MarketingDataProvider" NOT NULL,
    "providerQueryId" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "isAnonymized" BOOLEAN NOT NULL DEFAULT false,
    "status" "MarketingDimensionStatus" NOT NULL DEFAULT 'ACTIVE',
    "providerMetadata" JSONB,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingSearchQuery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingLandingPage" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT,
    "provider" "MarketingDataProvider" NOT NULL,
    "providerPageId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT,
    "status" "MarketingDimensionStatus" NOT NULL DEFAULT 'ACTIVE',
    "providerMetadata" JSONB,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingLandingPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingGeography" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT,
    "provider" "MarketingDataProvider" NOT NULL,
    "providerGeographyId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT,
    "status" "MarketingDimensionStatus" NOT NULL DEFAULT 'ACTIVE',
    "providerMetadata" JSONB,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingGeography_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingDevice" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "marketingDataSourceAccountId" TEXT,
    "provider" "MarketingDataProvider" NOT NULL,
    "providerDeviceId" TEXT NOT NULL,
    "deviceCategory" TEXT NOT NULL,
    "status" "MarketingDimensionStatus" NOT NULL DEFAULT 'ACTIVE',
    "providerMetadata" JSONB,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SearchConsoleUrlInspection" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "connectorAccountId" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "inspectionUrl" TEXT NOT NULL,
    "indexedState" TEXT,
    "crawlState" TEXT,
    "canonicalUrl" TEXT,
    "robotsTxtState" TEXT,
    "lastCrawlTime" TIMESTAMP(3),
    "mobileUsability" TEXT,
    "richResultsState" TEXT,
    "rawResponse" JSONB,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchConsoleUrlInspection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SearchConsoleSitemap" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "connectorAccountId" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "sitemapPath" TEXT NOT NULL,
    "lastSubmitted" TIMESTAMP(3),
    "lastDownloaded" TIMESTAMP(3),
    "warnings" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "discoveredUrls" INTEGER,
    "isPending" BOOLEAN NOT NULL DEFAULT false,
    "rawResponse" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SearchConsoleSitemap_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MarketingMetricObservation" ADD COLUMN "marketingSearchQueryId" TEXT;
ALTER TABLE "MarketingMetricObservation" ADD COLUMN "marketingLandingPageId" TEXT;
ALTER TABLE "MarketingMetricObservation" ADD COLUMN "marketingGeographyId" TEXT;
ALTER TABLE "MarketingMetricObservation" ADD COLUMN "marketingDeviceId" TEXT;

CREATE UNIQUE INDEX "MarketingSearchQuery_brandId_provider_providerQueryId_key" ON "MarketingSearchQuery"("brandId", "provider", "providerQueryId");
CREATE INDEX "MarketingSearchQuery_organisationId_brandId_idx" ON "MarketingSearchQuery"("organisationId", "brandId");
CREATE INDEX "MarketingSearchQuery_marketingDataSourceAccountId_idx" ON "MarketingSearchQuery"("marketingDataSourceAccountId");

CREATE UNIQUE INDEX "MarketingLandingPage_brandId_provider_providerPageId_key" ON "MarketingLandingPage"("brandId", "provider", "providerPageId");
CREATE INDEX "MarketingLandingPage_organisationId_brandId_idx" ON "MarketingLandingPage"("organisationId", "brandId");
CREATE INDEX "MarketingLandingPage_url_idx" ON "MarketingLandingPage"("url");

CREATE UNIQUE INDEX "MarketingGeography_brandId_provider_providerGeographyId_key" ON "MarketingGeography"("brandId", "provider", "providerGeographyId");
CREATE INDEX "MarketingGeography_organisationId_brandId_idx" ON "MarketingGeography"("organisationId", "brandId");

CREATE UNIQUE INDEX "MarketingDevice_brandId_provider_providerDeviceId_key" ON "MarketingDevice"("brandId", "provider", "providerDeviceId");
CREATE INDEX "MarketingDevice_organisationId_brandId_idx" ON "MarketingDevice"("organisationId", "brandId");

CREATE INDEX "SearchConsoleUrlInspection_organisationId_brandId_inspectedAt_idx" ON "SearchConsoleUrlInspection"("organisationId", "brandId", "inspectedAt");
CREATE INDEX "SearchConsoleUrlInspection_connectorAccountId_idx" ON "SearchConsoleUrlInspection"("connectorAccountId");

CREATE UNIQUE INDEX "SearchConsoleSitemap_connectorAccountId_sitemapPath_key" ON "SearchConsoleSitemap"("connectorAccountId", "sitemapPath");
CREATE INDEX "SearchConsoleSitemap_organisationId_brandId_idx" ON "SearchConsoleSitemap"("organisationId", "brandId");

ALTER TABLE "MarketingSearchQuery" ADD CONSTRAINT "MarketingSearchQuery_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingSearchQuery" ADD CONSTRAINT "MarketingSearchQuery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingSearchQuery" ADD CONSTRAINT "MarketingSearchQuery_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingSearchQuery" ADD CONSTRAINT "MarketingSearchQuery_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingLandingPage" ADD CONSTRAINT "MarketingLandingPage_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingLandingPage" ADD CONSTRAINT "MarketingLandingPage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingLandingPage" ADD CONSTRAINT "MarketingLandingPage_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingLandingPage" ADD CONSTRAINT "MarketingLandingPage_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingGeography" ADD CONSTRAINT "MarketingGeography_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingGeography" ADD CONSTRAINT "MarketingGeography_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingGeography" ADD CONSTRAINT "MarketingGeography_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingGeography" ADD CONSTRAINT "MarketingGeography_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingDevice" ADD CONSTRAINT "MarketingDevice_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingDevice" ADD CONSTRAINT "MarketingDevice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingDevice" ADD CONSTRAINT "MarketingDevice_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingDevice" ADD CONSTRAINT "MarketingDevice_marketingDataSourceAccountId_fkey" FOREIGN KEY ("marketingDataSourceAccountId") REFERENCES "MarketingDataSourceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SearchConsoleUrlInspection" ADD CONSTRAINT "SearchConsoleUrlInspection_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SearchConsoleUrlInspection" ADD CONSTRAINT "SearchConsoleUrlInspection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SearchConsoleUrlInspection" ADD CONSTRAINT "SearchConsoleUrlInspection_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SearchConsoleSitemap" ADD CONSTRAINT "SearchConsoleSitemap_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SearchConsoleSitemap" ADD CONSTRAINT "SearchConsoleSitemap_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SearchConsoleSitemap" ADD CONSTRAINT "SearchConsoleSitemap_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingMetricObservation" ADD CONSTRAINT "MarketingMetricObservation_marketingSearchQueryId_fkey" FOREIGN KEY ("marketingSearchQueryId") REFERENCES "MarketingSearchQuery"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingMetricObservation" ADD CONSTRAINT "MarketingMetricObservation_marketingLandingPageId_fkey" FOREIGN KEY ("marketingLandingPageId") REFERENCES "MarketingLandingPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingMetricObservation" ADD CONSTRAINT "MarketingMetricObservation_marketingGeographyId_fkey" FOREIGN KEY ("marketingGeographyId") REFERENCES "MarketingGeography"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingMetricObservation" ADD CONSTRAINT "MarketingMetricObservation_marketingDeviceId_fkey" FOREIGN KEY ("marketingDeviceId") REFERENCES "MarketingDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
