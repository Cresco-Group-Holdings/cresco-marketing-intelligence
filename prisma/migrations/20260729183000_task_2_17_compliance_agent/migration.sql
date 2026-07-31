-- Task 2.17 — Social compliance and brand safety agent

ALTER TYPE "AIPurpose" ADD VALUE IF NOT EXISTS 'COMPLIANCE_REVIEW_SUGGEST';

CREATE TYPE "CompliancePolicyCategory" AS ENUM (
  'BRAND',
  'FINANCIAL',
  'GRANTS',
  'PRIVACY',
  'COPYRIGHT',
  'LICENSING',
  'PLATFORM',
  'ACCESSIBILITY',
  'ADVERTISING',
  'AI_DISCLOSURE'
);

CREATE TYPE "ComplianceRiskLevel" AS ENUM (
  'INFO',
  'LOW',
  'MEDIUM',
  'HIGH',
  'BLOCKING'
);

CREATE TYPE "ComplianceEvaluationStatus" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED'
);

CREATE TYPE "ComplianceFindingSource" AS ENUM (
  'DETERMINISTIC',
  'AI'
);

CREATE TYPE "ComplianceFindingStatus" AS ENUM (
  'OPEN',
  'OVERRIDDEN',
  'DISMISSED',
  'RESOLVED'
);

CREATE TYPE "ComplianceEvaluationSource" AS ENUM (
  'DETERMINISTIC',
  'AI',
  'COMBINED'
);

CREATE TABLE "CompliancePolicy" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT,
  "brandId" TEXT,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "category" "CompliancePolicyCategory" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isTemplate" BOOLEAN NOT NULL DEFAULT false,
  "templateKey" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "description" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "supersededByPolicyId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompliancePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceRule" (
  "id" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "ruleKey" TEXT NOT NULL,
  "category" "CompliancePolicyCategory" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "riskLevel" "ComplianceRiskLevel" NOT NULL DEFAULT 'MEDIUM',
  "isBlocking" BOOLEAN NOT NULL DEFAULT false,
  "canOverride" BOOLEAN NOT NULL DEFAULT true,
  "matchPattern" TEXT,
  "ruleConfig" JSONB,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RequiredDisclaimer" (
  "id" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "disclaimerText" TEXT NOT NULL,
  "appliesToCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "appliesToContentTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isBlocking" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RequiredDisclaimer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceEvaluation" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "contentItemId" TEXT NOT NULL,
  "contentVariantId" TEXT,
  "policyId" TEXT NOT NULL,
  "policyVersion" INTEGER NOT NULL,
  "status" "ComplianceEvaluationStatus" NOT NULL DEFAULT 'PENDING',
  "source" "ComplianceEvaluationSource" NOT NULL DEFAULT 'DETERMINISTIC',
  "evaluatedAt" TIMESTAMP(3),
  "evaluatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceFinding" (
  "id" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "ruleId" TEXT,
  "ruleReference" TEXT,
  "source" "ComplianceFindingSource" NOT NULL,
  "category" "CompliancePolicyCategory" NOT NULL,
  "riskLevel" "ComplianceRiskLevel" NOT NULL,
  "isBlocking" BOOLEAN NOT NULL DEFAULT false,
  "status" "ComplianceFindingStatus" NOT NULL DEFAULT 'OPEN',
  "excerpt" TEXT,
  "message" TEXT NOT NULL,
  "explanation" TEXT,
  "suggestedCorrection" TEXT,
  "contentVariantId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceFinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceOverride" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "findingId" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "contentItemId" TEXT NOT NULL,
  "contentVariantId" TEXT,
  "reason" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompliancePolicy_organisationId_slug_version_key" ON "CompliancePolicy"("organisationId", "slug", "version");
CREATE INDEX "CompliancePolicy_organisationId_brandId_isActive_idx" ON "CompliancePolicy"("organisationId", "brandId", "isActive");
CREATE INDEX "CompliancePolicy_templateKey_idx" ON "CompliancePolicy"("templateKey");
CREATE UNIQUE INDEX "ComplianceRule_policyId_ruleKey_key" ON "ComplianceRule"("policyId", "ruleKey");
CREATE INDEX "ComplianceRule_policyId_category_idx" ON "ComplianceRule"("policyId", "category");
CREATE INDEX "RequiredDisclaimer_policyId_idx" ON "RequiredDisclaimer"("policyId");
CREATE INDEX "ComplianceEvaluation_organisationId_brandId_contentItemId_idx" ON "ComplianceEvaluation"("organisationId", "brandId", "contentItemId");
CREATE INDEX "ComplianceEvaluation_contentItemId_createdAt_idx" ON "ComplianceEvaluation"("contentItemId", "createdAt");
CREATE INDEX "ComplianceEvaluation_policyId_idx" ON "ComplianceEvaluation"("policyId");
CREATE INDEX "ComplianceFinding_evaluationId_status_idx" ON "ComplianceFinding"("evaluationId", "status");
CREATE INDEX "ComplianceFinding_riskLevel_isBlocking_idx" ON "ComplianceFinding"("riskLevel", "isBlocking");
CREATE INDEX "ComplianceOverride_evaluationId_idx" ON "ComplianceOverride"("evaluationId");
CREATE INDEX "ComplianceOverride_findingId_idx" ON "ComplianceOverride"("findingId");
CREATE INDEX "ComplianceOverride_contentItemId_idx" ON "ComplianceOverride"("contentItemId");

ALTER TABLE "CompliancePolicy" ADD CONSTRAINT "CompliancePolicy_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompliancePolicy" ADD CONSTRAINT "CompliancePolicy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompliancePolicy" ADD CONSTRAINT "CompliancePolicy_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompliancePolicy" ADD CONSTRAINT "CompliancePolicy_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ComplianceRule" ADD CONSTRAINT "ComplianceRule_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "CompliancePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RequiredDisclaimer" ADD CONSTRAINT "RequiredDisclaimer_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "CompliancePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComplianceEvaluation" ADD CONSTRAINT "ComplianceEvaluation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceEvaluation" ADD CONSTRAINT "ComplianceEvaluation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceEvaluation" ADD CONSTRAINT "ComplianceEvaluation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceEvaluation" ADD CONSTRAINT "ComplianceEvaluation_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceEvaluation" ADD CONSTRAINT "ComplianceEvaluation_contentVariantId_fkey" FOREIGN KEY ("contentVariantId") REFERENCES "ContentVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ComplianceEvaluation" ADD CONSTRAINT "ComplianceEvaluation_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "CompliancePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceEvaluation" ADD CONSTRAINT "ComplianceEvaluation_evaluatedByUserId_fkey" FOREIGN KEY ("evaluatedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ComplianceFinding" ADD CONSTRAINT "ComplianceFinding_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "ComplianceEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceFinding" ADD CONSTRAINT "ComplianceFinding_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ComplianceRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ComplianceOverride" ADD CONSTRAINT "ComplianceOverride_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceOverride" ADD CONSTRAINT "ComplianceOverride_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "ComplianceEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceOverride" ADD CONSTRAINT "ComplianceOverride_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "ComplianceFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceOverride" ADD CONSTRAINT "ComplianceOverride_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "CompliancePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceOverride" ADD CONSTRAINT "ComplianceOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
