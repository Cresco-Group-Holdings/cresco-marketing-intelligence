-- Knowledge Base and Brand Intelligence Core

CREATE TYPE "KnowledgeBaseStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "KnowledgeEntryType" AS ENUM (
  'BRAND_GUIDELINE', 'TONE_OF_VOICE', 'PRODUCT', 'SERVICE', 'AUDIENCE', 'PERSONA', 'ICP',
  'COMPETITOR', 'FAQ', 'CASE_STUDY', 'APPROVED_CLAIM', 'PROHIBITED_CLAIM', 'POLICY',
  'CAMPAIGN_CONTEXT', 'SALES_MATERIAL', 'GENERAL'
);
CREATE TYPE "KnowledgeEntryStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');
CREATE TYPE "KnowledgeEntrySourceType" AS ENUM ('MANUAL', 'DOCUMENT', 'URL', 'IMPORT', 'SYSTEM');
CREATE TYPE "KnowledgeRelationshipType" AS ENUM ('RELATED', 'CONFLICTS_WITH', 'SUPERSEDES', 'DERIVED_FROM');
CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('PROCESSING', 'READY', 'QUARANTINED', 'REJECTED', 'ARCHIVED');
CREATE TYPE "KnowledgeActivityAction" AS ENUM (
  'CREATED', 'UPDATED', 'SUBMITTED_FOR_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED', 'RESTORED',
  'VERSION_CREATED', 'DOCUMENT_UPLOADED', 'TAG_ADDED', 'TAG_REMOVED', 'RELATIONSHIP_ADDED', 'RELATIONSHIP_REMOVED'
);

CREATE TABLE "KnowledgeBase" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "KnowledgeBaseStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeEntry" (
  "id" TEXT NOT NULL,
  "knowledgeBaseId" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT,
  "campaignId" TEXT,
  "type" "KnowledgeEntryType" NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "content" TEXT NOT NULL,
  "status" "KnowledgeEntryStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceType" "KnowledgeEntrySourceType" NOT NULL DEFAULT 'MANUAL',
  "sourceReference" TEXT,
  "confidence" DECIMAL(5,4),
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "KnowledgeEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeEntryVersion" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "content" TEXT NOT NULL,
  "type" "KnowledgeEntryType" NOT NULL,
  "status" "KnowledgeEntryStatus" NOT NULL,
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "changedByUserId" TEXT NOT NULL,
  "changeNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeEntryVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeDocument" (
  "id" TEXT NOT NULL,
  "knowledgeBaseId" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT,
  "entryId" TEXT,
  "title" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSizeBytes" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'PROCESSING',
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "uploadedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeDocumentVersion" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSizeBytes" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "extractedText" TEXT,
  "uploadedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeDocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeTag" (
  "id" TEXT NOT NULL,
  "knowledgeBaseId" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "colour" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeEntryTag" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeEntryTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeRelationship" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "sourceEntryId" TEXT NOT NULL,
  "targetEntryId" TEXT NOT NULL,
  "relationshipType" "KnowledgeRelationshipType" NOT NULL,
  "note" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeRelationship_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeActivity" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "knowledgeBaseId" TEXT NOT NULL,
  "entryId" TEXT,
  "documentId" TEXT,
  "actorUserId" TEXT NOT NULL,
  "action" "KnowledgeActivityAction" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeEntryVersion_entryId_version_key" ON "KnowledgeEntryVersion"("entryId", "version");
CREATE INDEX "KnowledgeEntryVersion_entryId_createdAt_idx" ON "KnowledgeEntryVersion"("entryId", "createdAt");
CREATE INDEX "KnowledgeEntry_knowledgeBaseId_status_idx" ON "KnowledgeEntry"("knowledgeBaseId", "status");
CREATE INDEX "KnowledgeEntry_organisationId_brandId_type_status_idx" ON "KnowledgeEntry"("organisationId", "brandId", "type", "status");
CREATE INDEX "KnowledgeEntry_campaignId_idx" ON "KnowledgeEntry"("campaignId");
CREATE INDEX "KnowledgeEntry_validFrom_validUntil_idx" ON "KnowledgeEntry"("validFrom", "validUntil");
CREATE INDEX "KnowledgeBase_organisationId_brandId_status_idx" ON "KnowledgeBase"("organisationId", "brandId", "status");
CREATE INDEX "KnowledgeBase_projectId_idx" ON "KnowledgeBase"("projectId");
CREATE INDEX "KnowledgeDocument_knowledgeBaseId_status_idx" ON "KnowledgeDocument"("knowledgeBaseId", "status");
CREATE INDEX "KnowledgeDocument_organisationId_brandId_idx" ON "KnowledgeDocument"("organisationId", "brandId");
CREATE INDEX "KnowledgeDocument_entryId_idx" ON "KnowledgeDocument"("entryId");
CREATE UNIQUE INDEX "KnowledgeDocumentVersion_documentId_version_key" ON "KnowledgeDocumentVersion"("documentId", "version");
CREATE INDEX "KnowledgeDocumentVersion_documentId_idx" ON "KnowledgeDocumentVersion"("documentId");
CREATE UNIQUE INDEX "KnowledgeTag_knowledgeBaseId_name_key" ON "KnowledgeTag"("knowledgeBaseId", "name");
CREATE INDEX "KnowledgeTag_organisationId_idx" ON "KnowledgeTag"("organisationId");
CREATE UNIQUE INDEX "KnowledgeEntryTag_entryId_tagId_key" ON "KnowledgeEntryTag"("entryId", "tagId");
CREATE INDEX "KnowledgeEntryTag_tagId_idx" ON "KnowledgeEntryTag"("tagId");
CREATE UNIQUE INDEX "KnowledgeRelationship_sourceEntryId_targetEntryId_relationshipType_key" ON "KnowledgeRelationship"("sourceEntryId", "targetEntryId", "relationshipType");
CREATE INDEX "KnowledgeRelationship_targetEntryId_idx" ON "KnowledgeRelationship"("targetEntryId");
CREATE INDEX "KnowledgeActivity_knowledgeBaseId_createdAt_idx" ON "KnowledgeActivity"("knowledgeBaseId", "createdAt");
CREATE INDEX "KnowledgeActivity_entryId_createdAt_idx" ON "KnowledgeActivity"("entryId", "createdAt");
CREATE INDEX "KnowledgeActivity_organisationId_createdAt_idx" ON "KnowledgeActivity"("organisationId", "createdAt");

ALTER TABLE "KnowledgeBase" ADD CONSTRAINT "KnowledgeBase_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeBase" ADD CONSTRAINT "KnowledgeBase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeBase" ADD CONSTRAINT "KnowledgeBase_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ContentCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KnowledgeEntryVersion" ADD CONSTRAINT "KnowledgeEntryVersion_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "KnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeEntryVersion" ADD CONSTRAINT "KnowledgeEntryVersion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeEntryVersion" ADD CONSTRAINT "KnowledgeEntryVersion_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "KnowledgeEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocumentVersion" ADD CONSTRAINT "KnowledgeDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocumentVersion" ADD CONSTRAINT "KnowledgeDocumentVersion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocumentVersion" ADD CONSTRAINT "KnowledgeDocumentVersion_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KnowledgeTag" ADD CONSTRAINT "KnowledgeTag_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeTag" ADD CONSTRAINT "KnowledgeTag_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeEntryTag" ADD CONSTRAINT "KnowledgeEntryTag_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "KnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeEntryTag" ADD CONSTRAINT "KnowledgeEntryTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "KnowledgeTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeRelationship" ADD CONSTRAINT "KnowledgeRelationship_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeRelationship" ADD CONSTRAINT "KnowledgeRelationship_sourceEntryId_fkey" FOREIGN KEY ("sourceEntryId") REFERENCES "KnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeRelationship" ADD CONSTRAINT "KnowledgeRelationship_targetEntryId_fkey" FOREIGN KEY ("targetEntryId") REFERENCES "KnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeRelationship" ADD CONSTRAINT "KnowledgeRelationship_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KnowledgeActivity" ADD CONSTRAINT "KnowledgeActivity_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeActivity" ADD CONSTRAINT "KnowledgeActivity_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeActivity" ADD CONSTRAINT "KnowledgeActivity_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "KnowledgeEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KnowledgeActivity" ADD CONSTRAINT "KnowledgeActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
