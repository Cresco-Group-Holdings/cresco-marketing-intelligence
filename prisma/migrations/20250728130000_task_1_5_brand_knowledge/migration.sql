-- CreateEnum
CREATE TYPE "BrandOfferAvailabilityStatus" AS ENUM ('AVAILABLE', 'LIMITED', 'COMING_SOON', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "BrandAssetType" AS ENUM ('LOGO', 'FAVICON', 'COLOUR_PALETTE', 'FONT', 'SCREENSHOT', 'PRODUCT_IMAGE', 'PRESENTATION', 'VIDEO_CLIP');

-- CreateEnum
CREATE TYPE "BrandReferenceType" AS ENUM ('STYLE_GUIDE', 'DOCUMENTATION', 'EXTERNAL_LINK', 'RESEARCH', 'OTHER');

-- CreateEnum
CREATE TYPE "BrandComplianceRuleType" AS ENUM ('PROHIBITED_CLAIM', 'REQUIRED_DISCLAIMER', 'GRANT_ELIGIBILITY', 'PRIVACY', 'REGULATED_MARKET', 'CONTENT_APPROVAL', 'OTHER');

-- CreateEnum
CREATE TYPE "BrandComplianceSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "BrandAudience" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "industries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "organisationType" TEXT,
    "companySize" TEXT,
    "jobRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "painPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "motivations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "objections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "buyingTriggers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "BrandAudience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandPersona" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "roleTitle" TEXT,
    "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "painPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "motivations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "objections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "buyingTriggers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "BrandPersona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandOffer" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priceDescription" TEXT,
    "trialAvailable" BOOLEAN NOT NULL DEFAULT false,
    "primaryCta" TEXT,
    "landingPageUrl" TEXT,
    "eligibilityRestrictions" TEXT,
    "availabilityStatus" "BrandOfferAvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "BrandOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandMessage" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "elevatorPitch" TEXT,
    "coreMessage" TEXT,
    "supportingMessages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "proofPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "differentiators" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "objectionResponses" JSONB,
    "ctaLibrary" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prohibitedClaims" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandVoiceRule" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "preferredTone" TEXT,
    "vocabulary" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prohibitedVocabulary" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentenceStyle" TEXT,
    "emojiPolicy" TEXT,
    "humourPolicy" TEXT,
    "preferredSpelling" TEXT,
    "languageVariants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approvedExamples" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unacceptableExamples" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandVoiceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandCompetitor" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "description" TEXT,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weaknesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "positioning" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "BrandCompetitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandAsset" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "assetType" "BrandAssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT,
    "mimeType" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "BrandAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandReference" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "referenceType" "BrandReferenceType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "BrandReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandComplianceRule" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "ruleType" "BrandComplianceRuleType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ruleText" TEXT NOT NULL,
    "severity" "BrandComplianceSeverity" NOT NULL DEFAULT 'WARNING',
    "appliesTo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "BrandComplianceRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrandAudience_organisationId_idx" ON "BrandAudience"("organisationId");
CREATE INDEX "BrandAudience_projectId_idx" ON "BrandAudience"("projectId");
CREATE INDEX "BrandAudience_brandId_idx" ON "BrandAudience"("brandId");
CREATE INDEX "BrandAudience_archivedAt_idx" ON "BrandAudience"("archivedAt");

CREATE INDEX "BrandPersona_organisationId_idx" ON "BrandPersona"("organisationId");
CREATE INDEX "BrandPersona_projectId_idx" ON "BrandPersona"("projectId");
CREATE INDEX "BrandPersona_brandId_idx" ON "BrandPersona"("brandId");
CREATE INDEX "BrandPersona_archivedAt_idx" ON "BrandPersona"("archivedAt");

CREATE INDEX "BrandOffer_organisationId_idx" ON "BrandOffer"("organisationId");
CREATE INDEX "BrandOffer_projectId_idx" ON "BrandOffer"("projectId");
CREATE INDEX "BrandOffer_brandId_idx" ON "BrandOffer"("brandId");
CREATE INDEX "BrandOffer_archivedAt_idx" ON "BrandOffer"("archivedAt");

CREATE UNIQUE INDEX "BrandMessage_brandId_key" ON "BrandMessage"("brandId");
CREATE INDEX "BrandMessage_organisationId_idx" ON "BrandMessage"("organisationId");
CREATE INDEX "BrandMessage_projectId_idx" ON "BrandMessage"("projectId");

CREATE UNIQUE INDEX "BrandVoiceRule_brandId_key" ON "BrandVoiceRule"("brandId");
CREATE INDEX "BrandVoiceRule_organisationId_idx" ON "BrandVoiceRule"("organisationId");
CREATE INDEX "BrandVoiceRule_projectId_idx" ON "BrandVoiceRule"("projectId");

CREATE INDEX "BrandCompetitor_organisationId_idx" ON "BrandCompetitor"("organisationId");
CREATE INDEX "BrandCompetitor_projectId_idx" ON "BrandCompetitor"("projectId");
CREATE INDEX "BrandCompetitor_brandId_idx" ON "BrandCompetitor"("brandId");
CREATE INDEX "BrandCompetitor_archivedAt_idx" ON "BrandCompetitor"("archivedAt");

CREATE INDEX "BrandAsset_organisationId_idx" ON "BrandAsset"("organisationId");
CREATE INDEX "BrandAsset_projectId_idx" ON "BrandAsset"("projectId");
CREATE INDEX "BrandAsset_brandId_idx" ON "BrandAsset"("brandId");
CREATE INDEX "BrandAsset_assetType_idx" ON "BrandAsset"("assetType");
CREATE INDEX "BrandAsset_archivedAt_idx" ON "BrandAsset"("archivedAt");

CREATE INDEX "BrandReference_organisationId_idx" ON "BrandReference"("organisationId");
CREATE INDEX "BrandReference_projectId_idx" ON "BrandReference"("projectId");
CREATE INDEX "BrandReference_brandId_idx" ON "BrandReference"("brandId");
CREATE INDEX "BrandReference_archivedAt_idx" ON "BrandReference"("archivedAt");

CREATE INDEX "BrandComplianceRule_organisationId_idx" ON "BrandComplianceRule"("organisationId");
CREATE INDEX "BrandComplianceRule_projectId_idx" ON "BrandComplianceRule"("projectId");
CREATE INDEX "BrandComplianceRule_brandId_idx" ON "BrandComplianceRule"("brandId");
CREATE INDEX "BrandComplianceRule_ruleType_idx" ON "BrandComplianceRule"("ruleType");
CREATE INDEX "BrandComplianceRule_archivedAt_idx" ON "BrandComplianceRule"("archivedAt");

-- AddForeignKey
ALTER TABLE "BrandAudience" ADD CONSTRAINT "BrandAudience_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandAudience" ADD CONSTRAINT "BrandAudience_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandAudience" ADD CONSTRAINT "BrandAudience_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrandPersona" ADD CONSTRAINT "BrandPersona_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandPersona" ADD CONSTRAINT "BrandPersona_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandPersona" ADD CONSTRAINT "BrandPersona_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrandOffer" ADD CONSTRAINT "BrandOffer_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandOffer" ADD CONSTRAINT "BrandOffer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandOffer" ADD CONSTRAINT "BrandOffer_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrandMessage" ADD CONSTRAINT "BrandMessage_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandMessage" ADD CONSTRAINT "BrandMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandMessage" ADD CONSTRAINT "BrandMessage_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrandVoiceRule" ADD CONSTRAINT "BrandVoiceRule_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandVoiceRule" ADD CONSTRAINT "BrandVoiceRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandVoiceRule" ADD CONSTRAINT "BrandVoiceRule_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrandCompetitor" ADD CONSTRAINT "BrandCompetitor_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandCompetitor" ADD CONSTRAINT "BrandCompetitor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandCompetitor" ADD CONSTRAINT "BrandCompetitor_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrandAsset" ADD CONSTRAINT "BrandAsset_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandAsset" ADD CONSTRAINT "BrandAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandAsset" ADD CONSTRAINT "BrandAsset_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrandReference" ADD CONSTRAINT "BrandReference_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandReference" ADD CONSTRAINT "BrandReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandReference" ADD CONSTRAINT "BrandReference_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrandComplianceRule" ADD CONSTRAINT "BrandComplianceRule_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandComplianceRule" ADD CONSTRAINT "BrandComplianceRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandComplianceRule" ADD CONSTRAINT "BrandComplianceRule_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
