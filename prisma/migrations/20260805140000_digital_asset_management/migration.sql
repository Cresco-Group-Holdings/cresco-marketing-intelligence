-- Digital Asset Management (Stage 3)

CREATE TYPE "DigitalAssetType" AS ENUM (
  'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'LOGO', 'TEMPLATE', 'AD_CREATIVE', 'SOCIAL_CREATIVE', 'OTHER'
);
CREATE TYPE "DigitalAssetStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED', 'ARCHIVED');
CREATE TYPE "DigitalAssetUsageEntityType" AS ENUM (
  'CAMPAIGN', 'CONTENT_ITEM', 'ADVERTISEMENT', 'KNOWLEDGE_ENTRY', 'BRAND'
);
CREATE TYPE "DigitalAssetProcessingJobType" AS ENUM (
  'CHECKSUM', 'METADATA', 'THUMBNAIL', 'SAFETY_VALIDATION', 'PREVIEW'
);
CREATE TYPE "DigitalAssetProcessingJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "DigitalAssetActivityAction" AS ENUM (
  'CREATED', 'UPLOADED', 'VERSION_REPLACED', 'PROCESSING_COMPLETED', 'PROCESSING_FAILED',
  'ARCHIVED', 'RESTORED', 'TAG_ADDED', 'TAG_REMOVED', 'COLLECTION_ADDED', 'COLLECTION_REMOVED',
  'USAGE_RECORDED', 'USAGE_REMOVED', 'BULK_ARCHIVED', 'DOWNLOADED'
);

CREATE TABLE "DigitalAsset" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT,
  "brandId" TEXT,
  "campaignId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" "DigitalAssetType" NOT NULL,
  "status" "DigitalAssetStatus" NOT NULL DEFAULT 'UPLOADING',
  "storageProvider" TEXT NOT NULL DEFAULT 'supabase',
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "durationSeconds" INTEGER,
  "checksum" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "thumbnailStorageKey" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "DigitalAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DigitalAssetVersion" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "checksum" TEXT NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "durationSeconds" INTEGER,
  "uploadedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DigitalAssetVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DigitalAssetTag" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "brandId" TEXT,
  "name" TEXT NOT NULL,
  "colour" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DigitalAssetTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DigitalAssetTagAssignment" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DigitalAssetTagAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DigitalAssetUsage" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "entityType" "DigitalAssetUsageEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "usageRole" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "DigitalAssetUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DigitalAssetCollection" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "brandId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DigitalAssetCollection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DigitalAssetCollectionItem" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DigitalAssetCollectionItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DigitalAssetMetadata" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "metadataKey" TEXT NOT NULL,
  "stringValue" TEXT,
  "numberValue" DOUBLE PRECISION,
  "jsonValue" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DigitalAssetMetadata_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DigitalAssetActivity" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" "DigitalAssetActivityAction" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DigitalAssetActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DigitalAssetProcessingJob" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "jobType" "DigitalAssetProcessingJobType" NOT NULL,
  "status" "DigitalAssetProcessingJobStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "lastError" TEXT,
  "result" JSONB,
  "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DigitalAssetProcessingJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DigitalAsset_storageKey_key" ON "DigitalAsset"("storageKey");
CREATE INDEX "DigitalAsset_organisationId_brandId_status_idx" ON "DigitalAsset"("organisationId", "brandId", "status");
CREATE INDEX "DigitalAsset_organisationId_checksum_idx" ON "DigitalAsset"("organisationId", "checksum");
CREATE INDEX "DigitalAsset_campaignId_idx" ON "DigitalAsset"("campaignId");
CREATE INDEX "DigitalAsset_type_status_idx" ON "DigitalAsset"("type", "status");
CREATE UNIQUE INDEX "DigitalAssetVersion_assetId_version_key" ON "DigitalAssetVersion"("assetId", "version");
CREATE UNIQUE INDEX "DigitalAssetVersion_storageKey_key" ON "DigitalAssetVersion"("storageKey");
CREATE INDEX "DigitalAssetVersion_assetId_idx" ON "DigitalAssetVersion"("assetId");
CREATE UNIQUE INDEX "DigitalAssetTag_organisationId_brandId_name_key" ON "DigitalAssetTag"("organisationId", "brandId", "name");
CREATE INDEX "DigitalAssetTag_organisationId_idx" ON "DigitalAssetTag"("organisationId");
CREATE UNIQUE INDEX "DigitalAssetTagAssignment_assetId_tagId_key" ON "DigitalAssetTagAssignment"("assetId", "tagId");
CREATE INDEX "DigitalAssetTagAssignment_tagId_idx" ON "DigitalAssetTagAssignment"("tagId");
CREATE UNIQUE INDEX "DigitalAssetUsage_assetId_entityType_entityId_key" ON "DigitalAssetUsage"("assetId", "entityType", "entityId");
CREATE INDEX "DigitalAssetUsage_entityType_entityId_idx" ON "DigitalAssetUsage"("entityType", "entityId");
CREATE INDEX "DigitalAssetUsage_assetId_idx" ON "DigitalAssetUsage"("assetId");
CREATE UNIQUE INDEX "DigitalAssetCollection_organisationId_brandId_name_key" ON "DigitalAssetCollection"("organisationId", "brandId", "name");
CREATE INDEX "DigitalAssetCollection_organisationId_idx" ON "DigitalAssetCollection"("organisationId");
CREATE UNIQUE INDEX "DigitalAssetCollectionItem_collectionId_assetId_key" ON "DigitalAssetCollectionItem"("collectionId", "assetId");
CREATE INDEX "DigitalAssetCollectionItem_assetId_idx" ON "DigitalAssetCollectionItem"("assetId");
CREATE UNIQUE INDEX "DigitalAssetMetadata_assetId_metadataKey_key" ON "DigitalAssetMetadata"("assetId", "metadataKey");
CREATE INDEX "DigitalAssetMetadata_organisationId_idx" ON "DigitalAssetMetadata"("organisationId");
CREATE INDEX "DigitalAssetActivity_assetId_createdAt_idx" ON "DigitalAssetActivity"("assetId", "createdAt");
CREATE INDEX "DigitalAssetActivity_organisationId_createdAt_idx" ON "DigitalAssetActivity"("organisationId", "createdAt");
CREATE UNIQUE INDEX "DigitalAssetProcessingJob_assetId_idempotencyKey_key" ON "DigitalAssetProcessingJob"("assetId", "idempotencyKey");
CREATE INDEX "DigitalAssetProcessingJob_status_scheduledFor_idx" ON "DigitalAssetProcessingJob"("status", "scheduledFor");
CREATE INDEX "DigitalAssetProcessingJob_organisationId_idx" ON "DigitalAssetProcessingJob"("organisationId");

ALTER TABLE "DigitalAsset" ADD CONSTRAINT "DigitalAsset_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAsset" ADD CONSTRAINT "DigitalAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAsset" ADD CONSTRAINT "DigitalAsset_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAsset" ADD CONSTRAINT "DigitalAsset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ContentCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DigitalAsset" ADD CONSTRAINT "DigitalAsset_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetVersion" ADD CONSTRAINT "DigitalAssetVersion_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "DigitalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetVersion" ADD CONSTRAINT "DigitalAssetVersion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetVersion" ADD CONSTRAINT "DigitalAssetVersion_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetTag" ADD CONSTRAINT "DigitalAssetTag_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetTag" ADD CONSTRAINT "DigitalAssetTag_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetTagAssignment" ADD CONSTRAINT "DigitalAssetTagAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "DigitalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetTagAssignment" ADD CONSTRAINT "DigitalAssetTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "DigitalAssetTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetUsage" ADD CONSTRAINT "DigitalAssetUsage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "DigitalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetUsage" ADD CONSTRAINT "DigitalAssetUsage_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetCollection" ADD CONSTRAINT "DigitalAssetCollection_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetCollection" ADD CONSTRAINT "DigitalAssetCollection_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetCollection" ADD CONSTRAINT "DigitalAssetCollection_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetCollectionItem" ADD CONSTRAINT "DigitalAssetCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "DigitalAssetCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetCollectionItem" ADD CONSTRAINT "DigitalAssetCollectionItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "DigitalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetMetadata" ADD CONSTRAINT "DigitalAssetMetadata_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "DigitalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetMetadata" ADD CONSTRAINT "DigitalAssetMetadata_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetActivity" ADD CONSTRAINT "DigitalAssetActivity_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetActivity" ADD CONSTRAINT "DigitalAssetActivity_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "DigitalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetActivity" ADD CONSTRAINT "DigitalAssetActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetProcessingJob" ADD CONSTRAINT "DigitalAssetProcessingJob_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetProcessingJob" ADD CONSTRAINT "DigitalAssetProcessingJob_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "DigitalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
