CREATE TYPE "VisualOutputType" AS ENUM ('SQUARE_POST', 'PORTRAIT_POST', 'LANDSCAPE_POST', 'INSTAGRAM_CAROUSEL', 'LINKEDIN_CAROUSEL', 'REEL_COVER', 'TIKTOK_COVER', 'YOUTUBE_THUMBNAIL', 'STORY_GRAPHIC', 'QUOTE_CARD', 'SIMPLE_INFOGRAPHIC');
CREATE TYPE "VisualElementType" AS ENUM ('TEXT', 'IMAGE', 'LOGO', 'SHAPE', 'BACKGROUND', 'ICON', 'CTA', 'PAGE_NUMBER');
CREATE TYPE "VisualProjectStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'EXPORTED', 'ARCHIVED');
CREATE TYPE "VisualExportFormat" AS ENUM ('PNG', 'JPG', 'WEBP', 'PDF', 'ZIP');
CREATE TYPE "VisualExportStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

CREATE TABLE "VisualTemplate" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT,
  "brandId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "outputType" "VisualOutputType" NOT NULL,
  "activeVersionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "VisualTemplate_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "VisualTemplateVersion" (
  "id" TEXT NOT NULL,
  "visualTemplateId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "canvasWidth" INTEGER NOT NULL,
  "canvasHeight" INTEGER NOT NULL,
  "layout" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VisualTemplateVersion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "VisualProject" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "templateId" TEXT,
  "templateVersionId" TEXT,
  "title" TEXT NOT NULL,
  "outputType" "VisualOutputType" NOT NULL,
  "status" "VisualProjectStatus" NOT NULL DEFAULT 'DRAFT',
  "settings" JSONB,
  "sourceContentId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "VisualProject_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "VisualPage" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "visualProjectId" TEXT NOT NULL,
  "pageNumber" INTEGER NOT NULL,
  "title" TEXT,
  "background" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VisualPage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "VisualElement" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "visualPageId" TEXT NOT NULL,
  "elementType" "VisualElementType" NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "properties" JSONB NOT NULL,
  "locked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VisualElement_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "VisualExport" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "visualProjectId" TEXT NOT NULL,
  "format" "VisualExportFormat" NOT NULL,
  "status" "VisualExportStatus" NOT NULL DEFAULT 'PENDING',
  "marketingAssetId" TEXT,
  "metadata" JSONB,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "VisualExport_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "VisualGeneration" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "visualProjectId" TEXT,
  "sourceAssetId" TEXT,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "parameters" JSONB NOT NULL,
  "moderation" JSONB,
  "estimatedCostUsd" DECIMAL(12,6),
  "commercialUseMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VisualGeneration_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ContentVariantAsset" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "contentVariantId" TEXT NOT NULL,
  "marketingAssetId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "altText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentVariantAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VisualTemplate_activeVersionId_key" ON "VisualTemplate"("activeVersionId");
CREATE UNIQUE INDEX "VisualTemplateVersion_visualTemplateId_version_key" ON "VisualTemplateVersion"("visualTemplateId", "version");
CREATE UNIQUE INDEX "VisualPage_visualProjectId_pageNumber_key" ON "VisualPage"("visualProjectId", "pageNumber");
CREATE UNIQUE INDEX "ContentVariantAsset_contentVariantId_marketingAssetId_key" ON "ContentVariantAsset"("contentVariantId", "marketingAssetId");
CREATE INDEX "VisualTemplate_organisationId_idx" ON "VisualTemplate"("organisationId");
CREATE INDEX "VisualTemplate_brandId_idx" ON "VisualTemplate"("brandId");
CREATE INDEX "VisualTemplate_outputType_idx" ON "VisualTemplate"("outputType");
CREATE INDEX "VisualProject_organisationId_idx" ON "VisualProject"("organisationId");
CREATE INDEX "VisualProject_projectId_idx" ON "VisualProject"("projectId");
CREATE INDEX "VisualProject_brandId_idx" ON "VisualProject"("brandId");
CREATE INDEX "VisualProject_status_idx" ON "VisualProject"("status");
CREATE INDEX "VisualPage_organisationId_idx" ON "VisualPage"("organisationId");
CREATE INDEX "VisualPage_brandId_idx" ON "VisualPage"("brandId");
CREATE INDEX "VisualElement_visualPageId_idx" ON "VisualElement"("visualPageId");
CREATE INDEX "VisualElement_organisationId_idx" ON "VisualElement"("organisationId");
CREATE INDEX "VisualExport_visualProjectId_idx" ON "VisualExport"("visualProjectId");
CREATE INDEX "VisualExport_organisationId_idx" ON "VisualExport"("organisationId");
CREATE INDEX "VisualGeneration_organisationId_idx" ON "VisualGeneration"("organisationId");
CREATE INDEX "VisualGeneration_brandId_idx" ON "VisualGeneration"("brandId");
CREATE INDEX "VisualGeneration_visualProjectId_idx" ON "VisualGeneration"("visualProjectId");
CREATE INDEX "ContentVariantAsset_organisationId_idx" ON "ContentVariantAsset"("organisationId");
CREATE INDEX "ContentVariantAsset_brandId_idx" ON "ContentVariantAsset"("brandId");

ALTER TABLE "VisualTemplate" ADD CONSTRAINT "VisualTemplate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualTemplate" ADD CONSTRAINT "VisualTemplate_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualTemplateVersion" ADD CONSTRAINT "VisualTemplateVersion_visualTemplateId_fkey" FOREIGN KEY ("visualTemplateId") REFERENCES "VisualTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualTemplate" ADD CONSTRAINT "VisualTemplate_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "VisualTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VisualProject" ADD CONSTRAINT "VisualProject_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualProject" ADD CONSTRAINT "VisualProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualProject" ADD CONSTRAINT "VisualProject_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualProject" ADD CONSTRAINT "VisualProject_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "VisualTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VisualProject" ADD CONSTRAINT "VisualProject_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "VisualTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VisualPage" ADD CONSTRAINT "VisualPage_visualProjectId_fkey" FOREIGN KEY ("visualProjectId") REFERENCES "VisualProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualPage" ADD CONSTRAINT "VisualPage_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualPage" ADD CONSTRAINT "VisualPage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualPage" ADD CONSTRAINT "VisualPage_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualElement" ADD CONSTRAINT "VisualElement_visualPageId_fkey" FOREIGN KEY ("visualPageId") REFERENCES "VisualPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualElement" ADD CONSTRAINT "VisualElement_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualElement" ADD CONSTRAINT "VisualElement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualElement" ADD CONSTRAINT "VisualElement_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualExport" ADD CONSTRAINT "VisualExport_visualProjectId_fkey" FOREIGN KEY ("visualProjectId") REFERENCES "VisualProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualExport" ADD CONSTRAINT "VisualExport_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualExport" ADD CONSTRAINT "VisualExport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualExport" ADD CONSTRAINT "VisualExport_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualExport" ADD CONSTRAINT "VisualExport_marketingAssetId_fkey" FOREIGN KEY ("marketingAssetId") REFERENCES "MarketingAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VisualGeneration" ADD CONSTRAINT "VisualGeneration_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualGeneration" ADD CONSTRAINT "VisualGeneration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualGeneration" ADD CONSTRAINT "VisualGeneration_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualGeneration" ADD CONSTRAINT "VisualGeneration_visualProjectId_fkey" FOREIGN KEY ("visualProjectId") REFERENCES "VisualProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VisualGeneration" ADD CONSTRAINT "VisualGeneration_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "MarketingAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentVariantAsset" ADD CONSTRAINT "ContentVariantAsset_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentVariantAsset" ADD CONSTRAINT "ContentVariantAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentVariantAsset" ADD CONSTRAINT "ContentVariantAsset_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentVariantAsset" ADD CONSTRAINT "ContentVariantAsset_contentVariantId_fkey" FOREIGN KEY ("contentVariantId") REFERENCES "ContentVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentVariantAsset" ADD CONSTRAINT "ContentVariantAsset_marketingAssetId_fkey" FOREIGN KEY ("marketingAssetId") REFERENCES "MarketingAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
