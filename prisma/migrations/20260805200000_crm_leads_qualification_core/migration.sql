-- Stage 8: CRM leads and qualification core

-- Extend lead status workflow
ALTER TYPE "CrmLeadStatus" ADD VALUE IF NOT EXISTS 'OPPORTUNITY';
ALTER TYPE "CrmLeadStatus" ADD VALUE IF NOT EXISTS 'WON';

-- Retention and consent enums
CREATE TYPE "CrmRetentionStatus" AS ENUM ('ACTIVE', 'SUPPRESSED', 'DELETION_REQUESTED', 'ANONYMISED', 'ARCHIVED');
CREATE TYPE "CrmConsentBasis" AS ENUM ('CONSENT', 'LEGITIMATE_INTEREST', 'CONTRACT', 'LEGAL_OBLIGATION', 'VITAL_INTEREST', 'PUBLIC_TASK', 'OTHER');
CREATE TYPE "CrmConsentRecordStatus" AS ENUM ('GRANTED', 'DENIED', 'WITHDRAWN', 'UNKNOWN');

-- Retention metadata on CRM leads
ALTER TABLE "CrmLead" ADD COLUMN IF NOT EXISTS "retentionStatus" "CrmRetentionStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "CrmLead" ADD COLUMN IF NOT EXISTS "lawfulBasis" "CrmConsentBasis";
ALTER TABLE "CrmLead" ADD COLUMN IF NOT EXISTS "anonymisedAt" TIMESTAMP(3);
ALTER TABLE "CrmLead" ADD COLUMN IF NOT EXISTS "deletionRequestedAt" TIMESTAMP(3);

-- Manual qualification assessments
CREATE TABLE "CrmQualificationAssessment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "assessorUserId" TEXT NOT NULL,
    "outcome" "CrmQualificationState" NOT NULL,
    "criteria" JSONB,
    "notes" TEXT,
    "metadata" JSONB,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmQualificationAssessment_pkey" PRIMARY KEY ("id")
);

-- Consent records for CRM leads
CREATE TABLE "CrmConsentRecord" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" "CrmConsentRecordStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lawfulBasis" "CrmConsentBasis",
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "contactEligible" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmConsentRecord_pkey" PRIMARY KEY ("id")
);

-- Manual lead scores
CREATE TABLE "CrmLeadManualScore" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL DEFAULT 100,
    "rationale" TEXT,
    "criteria" JSONB,
    "scoredByUserId" TEXT NOT NULL,
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmLeadManualScore_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrmQualificationAssessment_leadId_assessedAt_idx" ON "CrmQualificationAssessment"("leadId", "assessedAt");
CREATE INDEX "CrmQualificationAssessment_organisationId_brandId_idx" ON "CrmQualificationAssessment"("organisationId", "brandId");
CREATE INDEX "CrmConsentRecord_leadId_recordedAt_idx" ON "CrmConsentRecord"("leadId", "recordedAt");
CREATE INDEX "CrmConsentRecord_organisationId_brandId_idx" ON "CrmConsentRecord"("organisationId", "brandId");
CREATE INDEX "CrmLeadManualScore_leadId_scoredAt_idx" ON "CrmLeadManualScore"("leadId", "scoredAt");
CREATE INDEX "CrmLeadManualScore_organisationId_brandId_idx" ON "CrmLeadManualScore"("organisationId", "brandId");

ALTER TABLE "CrmQualificationAssessment" ADD CONSTRAINT "CrmQualificationAssessment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmQualificationAssessment" ADD CONSTRAINT "CrmQualificationAssessment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmQualificationAssessment" ADD CONSTRAINT "CrmQualificationAssessment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmQualificationAssessment" ADD CONSTRAINT "CrmQualificationAssessment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmQualificationAssessment" ADD CONSTRAINT "CrmQualificationAssessment_assessorUserId_fkey" FOREIGN KEY ("assessorUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrmConsentRecord" ADD CONSTRAINT "CrmConsentRecord_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmConsentRecord" ADD CONSTRAINT "CrmConsentRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmConsentRecord" ADD CONSTRAINT "CrmConsentRecord_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmConsentRecord" ADD CONSTRAINT "CrmConsentRecord_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmConsentRecord" ADD CONSTRAINT "CrmConsentRecord_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrmLeadManualScore" ADD CONSTRAINT "CrmLeadManualScore_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmLeadManualScore" ADD CONSTRAINT "CrmLeadManualScore_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmLeadManualScore" ADD CONSTRAINT "CrmLeadManualScore_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmLeadManualScore" ADD CONSTRAINT "CrmLeadManualScore_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmLeadManualScore" ADD CONSTRAINT "CrmLeadManualScore_scoredByUserId_fkey" FOREIGN KEY ("scoredByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
