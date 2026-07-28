-- CreateEnum
CREATE TYPE "MarketingAssetStatus" AS ENUM ('PROCESSING', 'READY', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MarketingAssetType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT');

-- CreateTable
CREATE TABLE "MarketingAsset" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" DECIMAL(10,3),
    "assetType" "MarketingAssetType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "MarketingAssetStatus" NOT NULL DEFAULT 'PROCESSING',
    "uploadedByUserId" TEXT NOT NULL,
    "approvedForMarketing" BOOLEAN NOT NULL DEFAULT false,
    "approvedPlatforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "licenceOwner" TEXT,
    "licenceNotes" TEXT,
    "licenceExpiresAt" TIMESTAMP(3),
    "attributionRequired" BOOLEAN NOT NULL DEFAULT false,
    "consentNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "MarketingAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingAsset_storageKey_key" ON "MarketingAsset"("storageKey");

-- CreateIndex
CREATE INDEX "MarketingAsset_organisationId_idx" ON "MarketingAsset"("organisationId");
CREATE INDEX "MarketingAsset_projectId_idx" ON "MarketingAsset"("projectId");
CREATE INDEX "MarketingAsset_brandId_idx" ON "MarketingAsset"("brandId");
CREATE INDEX "MarketingAsset_status_idx" ON "MarketingAsset"("status");
CREATE INDEX "MarketingAsset_assetType_idx" ON "MarketingAsset"("assetType");
CREATE INDEX "MarketingAsset_archivedAt_idx" ON "MarketingAsset"("archivedAt");
CREATE INDEX "MarketingAsset_uploadedByUserId_idx" ON "MarketingAsset"("uploadedByUserId");

-- AddForeignKey
ALTER TABLE "MarketingAsset" ADD CONSTRAINT "MarketingAsset_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAsset" ADD CONSTRAINT "MarketingAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAsset" ADD CONSTRAINT "MarketingAsset_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAsset" ADD CONSTRAINT "MarketingAsset_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
